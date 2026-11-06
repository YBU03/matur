// Unduh rekap titipan per barang + riwayat setoran (PDF & Excel) — dipakai untuk mencocokkan/menagih ke produsen.
import type { RekapBarang, RiwayatBarang, BarangTitipan } from "./titipan-barang-view";

const KEL: Record<string, string> = { dessert: "Dessert", snack: "Snack", lain: "Lainnya" };
const JENIS: Record<string, string> = { masuk: "Barang masuk", retur: "Retur", rusak: "Rusak", koreksi: "Koreksi" };
const rp = (n: number) => "Rp " + Math.round(Number(n) || 0).toLocaleString("id-ID");
const ang = (n: number) => (Number(n) || 0).toLocaleString("id-ID", { maximumFractionDigits: 2 });
const nm = (outlet: string, awal: string, akhir: string, ext: string) => `Titipan ${outlet} ${awal}${awal === akhir ? "" : "_" + akhir}.${ext}`.replace(/[\\/:*?"<>|]/g, "-");

type Data = { outlet: string; awal: string; akhir: string; rekap: RekapBarang[]; riwayat: RiwayatBarang[]; barang: BarangTitipan[]; namaMenu: Map<string, string> };

function barisRiwayat(d: Data) {
  const info = new Map(d.barang.map((b) => [b.id, b]));
  return [...d.riwayat]
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.created_at.localeCompare(b.created_at))
    .map((r) => {
      const b = r.barang_id ? info.get(r.barang_id) : undefined;
      return { tanggal: r.tanggal, barang: b?.nama ?? d.namaMenu.get(r.menu_id ?? "") ?? "?", jenis: JENIS[r.jenis ?? "masuk"] ?? r.jenis ?? "", qty: r.qty, satuan: b?.satuan ?? "porsi", catatan: r.catatan ?? "", oleh: r.nama_pembuat ?? "" };
    });
}

export async function unduhExcelTitipan(d: Data) {
  const { Workbook } = (await import("exceljs")).default;
  const wb = new Workbook();
  const ws = wb.addWorksheet("Rekap per barang");
  ws.addRow([`Rekap Titipan · ${d.outlet} · ${d.awal} s/d ${d.akhir}`]).font = { bold: true, size: 13 };
  ws.addRow(["Kelompok", "Barang", "Satuan", "Stok awal", "Masuk (setoran)", "Retur/rusak", "Terjual", "Sisa", "Harga/satuan", "Tagihan", "Asal terjual"]).font = { bold: true };
  for (const r of d.rekap)
    ws.addRow([KEL[r.kelompok] ?? r.kelompok, r.nama, r.satuan, Number(r.awal), Number(r.masuk), Number(r.keluar), Number(r.terjual), Number(r.sisa), Number(r.harga), Number(r.tagihan), r.asal.map((a) => `${a.menu} ${ang(a.porsi)} porsi → ${ang(a.jumlah)} ${r.satuan}`).join("; ")]);
  const tot = ws.addRow(["", "TOTAL TAGIHAN", "", "", "", "", "", "", "", d.rekap.reduce((t, r) => t + Number(r.tagihan), 0), ""]);
  tot.font = { bold: true };
  ws.columns.forEach((c, i) => {
    c.width = [12, 26, 8, 11, 14, 12, 10, 10, 13, 14, 50][i] ?? 12;
    if (i >= 3 && i <= 7) c.numFmt = "#,##0.##";
    if (i === 8 || i === 9) c.numFmt = '"Rp" #,##0';
  });
  ws.views = [{ state: "frozen", ySplit: 2 }];
  const ws2 = wb.addWorksheet("Riwayat setoran");
  ws2.addRow(["Tanggal", "Barang", "Jenis", "Jumlah", "Satuan", "Catatan", "Dicatat oleh"]).font = { bold: true };
  for (const r of barisRiwayat(d)) ws2.addRow([r.tanggal, r.barang, r.jenis, r.qty, r.satuan, r.catatan, r.oleh]);
  ws2.columns.forEach((c, i) => (c.width = [12, 26, 14, 10, 8, 36, 20][i] ?? 12));
  const blob = new Blob([await wb.xlsx.writeBuffer()], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nm(d.outlet, d.awal, d.akhir, "xlsx");
  a.click();
  URL.revokeObjectURL(a.href);
}

export async function buatPdfTitipan(d: Data, dicetak = new Date()) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const head = { fillColor: [104, 66, 34] as [number, number, number] };
  const styles = { font: "helvetica", fontSize: 8.5, cellPadding: 2, overflow: "linebreak" as const };
  doc.setFont("helvetica", "bold").setFontSize(15).text("Rekap Titipan Produk", 14, 16);
  doc.setFont("helvetica", "normal").setFontSize(10).text(`${d.outlet} · ${d.awal}${d.awal === d.akhir ? "" : " s/d " + d.akhir}`, 14, 22);
  doc.setFontSize(8).setTextColor(110).text(`Dicetak ${dicetak.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB · terjual dihitung otomatis dari POS × isi per porsi`, 14, 27);
  doc.setTextColor(0);
  let y = 32;
  for (const kel of ["dessert", "snack", "lain"]) {
    const xs = d.rekap.filter((r) => r.kelompok === kel);
    if (!xs.length) continue;
    autoTable(doc, {
      startY: y,
      head: [[KEL[kel], "Satuan", "Awal", "Masuk", "Retur/rusak", "Terjual", "Sisa", "Harga", "Tagihan"]],
      body: xs.map((r) => [r.nama, r.satuan, ang(r.awal), ang(r.masuk), ang(r.keluar), ang(r.terjual), ang(r.sisa), rp(r.harga), rp(r.tagihan)]),
      foot: [["Subtotal", "", "", "", "", "", "", "", rp(xs.reduce((t, r) => t + Number(r.tagihan), 0))]],
      headStyles: head, footStyles: { fillColor: [255, 246, 222], textColor: [67, 43, 23], fontStyle: "bold" }, styles,
      columnStyles: { 0: { cellWidth: 44 }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" }, 7: { halign: "right" }, 8: { halign: "right" } },
      margin: { left: 14, right: 14 },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }
  doc.setFont("helvetica", "bold").setFontSize(11).text(`Total tagihan: ${rp(d.rekap.reduce((t, r) => t + Number(r.tagihan), 0))}`, 14, y);
  y += 7;
  const rw = barisRiwayat(d);
  autoTable(doc, {
    startY: y,
    head: [["Tanggal", "Barang", "Jenis", "Jumlah", "Catatan", "Oleh"]],
    body: rw.length ? rw.map((r) => [r.tanggal, r.barang, r.jenis, `${r.qty > 0 ? "+" : ""}${ang(r.qty)} ${r.satuan}`, r.catatan, r.oleh]) : [["-", "Belum ada setoran tercatat di periode ini", "", "", "", ""]],
    headStyles: head, styles, columnStyles: { 3: { halign: "right" } }, margin: { left: 14, right: 14 },
  });
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(110);
    doc.text("Matoer | Titipan Produk", 14, 288);
    doc.text(`Halaman ${i} / ${n}`, 196, 288, { align: "right" });
  }
  return doc;
}

export async function unduhPdfTitipan(d: Data) {
  const doc = await buatPdfTitipan(d);
  doc.save(nm(d.outlet, d.awal, d.akhir, "pdf"));
}
