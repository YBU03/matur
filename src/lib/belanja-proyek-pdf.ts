import { formatRupiah as rp, formatTanggal } from "./format";
import { ringkasanBelanja, statusBelanja, terbayar, SUMBER_BELANJA, type Belanja } from "./belanja-proyek";
import type { Setoran } from "./proyek";

export type LaporanBelanja = { nama: string; rab: number; realisasiLama: number; setoran: Setoran[]; belanja: Belanja[] };

/** Seluruh proyek, bukan hanya nota yang sedang tampak pada filter. Tidak memuat signed URL bukti. */
export async function buatPdfRealisasi(data: LaporanBelanja, dicetak = new Date()) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const masuk = data.setoran.reduce((s, x) => s + Number(x.jumlah), 0);
  const r = ringkasanBelanja(data.belanja, data.realisasiLama, masuk);
  const head = { fillColor: [104, 66, 34] as [number, number, number] };
  const styles = { fontSize: 9, cellPadding: 2.5, overflow: "linebreak" as const };
  let y = 16;
  doc.setFontSize(15).setFont("helvetica", "bold").text("Realisasi Belanja Proyek", 14, y);
  const judul = doc.splitTextToSize(data.nama, 180);
  doc.setFontSize(11).text(judul, 14, y += 7);
  y += judul.length * 5;
  doc.setFont("helvetica", "normal").setFontSize(9).text(`Seluruh nota proyek | Dicetak ${formatTanggal(dicetak.toISOString(), true)} WIB`, 14, y);
  y += 5;
  const table = (headers: string[], body: string[][], moneyColumns: number[] = []) => {
    if (y > 240) { doc.addPage(); y = 16; }
    autoTable(doc, { startY: y, head: [headers], body, headStyles: head, styles,
      margin: { top: 16, bottom: 18, left: 14, right: 14 }, rowPageBreak: "avoid",
      columnStyles: Object.fromEntries((headers.length === 1 ? [182] : headers.length === 2 ? (headers[0] === "Ringkasan dana" ? [130, 52] : [48, 134]) : headers.length === 3 ? [30, 116, 36] : headers[0] === "Barang / jasa" ? [86, 24, 36, 36] : [30, 48, 68, 36]).map((width, i) => [i, { cellWidth: width, ...(moneyColumns.includes(i) ? { halign: "right" as const } : {}) }])),
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7;
  };
  const heading = (text: string) => {
    if (y > 220) { doc.addPage(); y = 16; }
    const lines = doc.splitTextToSize(text, 180);
    doc.setFont("helvetica", "bold").setFontSize(10).text(lines, 14, y);
    y += lines.length * 5 + 2;
    doc.setFont("helvetica", "normal");
  };
  table(["Ringkasan dana", "Jumlah"], [
    ["Grand Total RAB", rp(data.rab)], ["Dana Masuk Mitra", rp(masuk)],
    ["Realisasi Pembayaran (dari dana proyek)", rp(r.dariProyek)], ["Sisa Dana Aktual", rp(r.saldo)],
    ["Total nilai pesanan / nota aktif", rp(r.nota)], ["Total sudah dibayar (semua sumber)", rp(r.dibayar)],
    ["Sisa tagihan nota", rp(r.tagihan)], ["Talangan pusat", rp(r.talangan)], ["Dibayar langsung mitra", rp(r.mitra)],
    ...(data.realisasiLama ? [["Realisasi lama - pembayaran belum dirinci", rp(data.realisasiLama)]] : []),
  ], [1]);
  table(["Dasar perhitungan"], [["Sisa Dana Aktual = dana masuk mitra dikurangi DP dan pelunasan dari dana proyek. Talangan pusat dan pembayaran langsung mitra tidak mengurangi saldo ini. RAB adalah anggaran, bukan harga pesanan aktual."],
    ...(data.realisasiLama ? [["Pembayaran realisasi lama belum dirinci dan belum mengurangi saldo. Cocokkan sebelum menggunakan saldo sebagai uang tersedia."]] : []),
  ]);
  heading("Dana masuk mitra");
  table(["Tanggal", "Keterangan", "Jumlah"], data.setoran.length ? data.setoran.map(s => [formatTanggal(s.tanggal), s.keterangan || "-", rp(s.jumlah)]) : [["-", "Belum ada dana masuk", rp(0)]], [2]);
  for (const [index, b] of data.belanja.entries()) {
    heading(`${index + 1}. ${b.toko} | ${formatTanggal(b.tanggal)} | ${statusBelanja(b)}`);
    table(["Informasi nota", "Rincian"], [
      ["Nomor nota", b.nomor_nota || "-"], ["Penanggung jawab", b.penanggung_jawab], ["Dicatat oleh", b.nama_pencatat],
      ["Total pesanan", rp(b.total)], ["Sudah dibayar", rp(terbayar(b))], ["Sisa tagihan", rp(b.total - terbayar(b))],
      ...(b.catatan ? [["Catatan", b.catatan]] : []),
      ...(b.batal_at ? [["Pembatalan (tidak masuk ringkasan aktif)", b.alasan_batal || "Dibatalkan"]] : []),
    ]);
    table(["Barang / jasa", "Jumlah", "Harga satuan", "Total"], b.items.map(i => [i.nama, `${i.qty} ${i.satuan || ""}`.trim(), rp(i.harga_satuan), rp(i.jumlah)]), [2, 3]);
    table(["Tanggal bayar", "Sumber / metode", "Catatan / pencatat", "Dibayar"], b.pembayaran.length ? b.pembayaran.map(p => [formatTanggal(p.tanggal), `${SUMBER_BELANJA[p.sumber]} / ${p.metode}`, [p.catatan, `Dicatat: ${p.nama_pencatat}`].filter(Boolean).join("\n"), rp(p.jumlah)]) : [["-", "Belum ada pembayaran", "-", rp(0)]], [3]);
  }
  if (!data.belanja.length) { heading("Belum ada realisasi belanja tercatat."); }
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i); doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(110);
    doc.text("Matur | Realisasi Belanja", 14, 288);
    doc.text(`Halaman ${i} / ${pages}`, 196, 288, { align: "right" });
  }
  return doc;
}
