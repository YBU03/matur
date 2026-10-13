// Surat jalan & invoice kiriman bahan (PDF A4, dibuat di browser)
import { formatRupiah, formatTanggal } from "@/lib/format";
import type { ItemKiriman, Kiriman } from "@/lib/kiriman";
import { gambar, kopSurat, unduh, type Kop } from "@/lib/pdf-kop";

const nf = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });

export async function cetakDokumen(jenis: "surat-jalan" | "invoice", k: Kiriman, items: ItemKiriman[], pt: Kop) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  let y = await kopSurat(doc, pt);
  const invoice = jenis === "invoice";
  doc.setFont("helvetica", "bold").setFontSize(14).text(invoice ? "INVOICE" : "SURAT JALAN", W / 2, (y += 9), { align: "center" });
  if (k.status === "draft" || k.status === "batal") {
    doc.setTextColor(200, 0, 0).setFontSize(10).text(k.status === "draft" ? "DRAFT — belum dikirim" : "DIBATALKAN", W / 2, (y += 5), { align: "center" });
    doc.setTextColor(0);
  }
  autoTable(doc, {
    theme: "plain",
    startY: y + 4,
    styles: { fontSize: 9, cellPadding: 0.8 },
    body: [
      ["Nomor", ":", k.nomor, "Tanggal", ":", formatTanggal(k.tanggal)],
      ["Kepada", ":", k.outlet?.nama ?? "-", "Dari", ":", "Gudang Pusat"],
      ["Alamat", ":", k.outlet?.alamat ?? "-", "Status", ":", k.status],
    ],
    columnStyles: { 0: { cellWidth: 18 }, 1: { cellWidth: 3 }, 3: { cellWidth: 16 }, 4: { cellWidth: 3 } },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 3;
  const qtyPakai = (i: ItemKiriman) => (k.status === "diterima" && i.qty_diterima !== null ? i.qty_diterima : i.qty);
  const total = items.reduce((s, i) => s + Math.round(qtyPakai(i) * i.harga), 0);
  autoTable(doc, {
    startY: y,
    head: [invoice ? ["No", "Nama Barang", "Jumlah", "Satuan", "Harga", "Subtotal"] : ["No", "Nama Barang", "Jumlah Kirim", "Satuan", "Diterima", "Keterangan"]],
    body: items.map((i, n) =>
      invoice
        ? [String(n + 1), i.nama, nf.format(qtyPakai(i)), i.satuan ?? "", formatRupiah(i.harga), formatRupiah(Math.round(qtyPakai(i) * i.harga))]
        : [String(n + 1), i.nama, nf.format(i.qty), i.satuan ?? "", i.qty_diterima === null ? "" : nf.format(i.qty_diterima), ""],
    ),
    foot: invoice ? [["", "TOTAL", "", "", "", formatRupiah(total)]] : undefined,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [255, 149, 0] },
    footStyles: { fillColor: [255, 239, 194], textColor: 20, fontStyle: "bold" },
    columnStyles: invoice ? { 2: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } } : { 2: { halign: "right" }, 4: { halign: "right" } },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  doc.setFont("helvetica", "normal").setFontSize(9);
  if (k.catatan) {
    doc.text(`Catatan: ${k.catatan}`, 14, y, { maxWidth: W - 28 });
    y += 8;
  }
  if (invoice) {
    doc.text("Nilai invoice dicatat sebagai pembelian bahan baku outlet pada periode diterima.", 14, y);
    y += 8;
  }
  if (y > 240) {
    doc.addPage();
    y = 20;
  }
  // tanda tangan
  const cols = invoice ? [["Hormat kami,", pt.nama]] : [["Pengirim", k.pengirim ?? ""], ["Penerima", k.nama_penerima ?? ""]];
  if (invoice) {
    const ttd = await gambar("/brand/ttd-hazna.png");
    const th = 20, tw = (th * ttd.w) / ttd.h;
    doc.text(cols[0][0], W - 50, y + 4, { align: "center" });
    doc.addImage(ttd.url, "PNG", W - 50 - tw / 2, y + 6, tw, th);
    doc.setFont("helvetica", "bold").text(cols[0][1], W - 50, y + 31, { align: "center" });
  } else {
    cols.forEach(([l, n], i) => {
      const x = i === 0 ? 45 : W - 45;
      doc.setFont("helvetica", "normal").text(l, x, y + 4, { align: "center" });
      doc.line(x - 25, y + 26, x + 25, y + 26);
      doc.text(n, x, y + 31, { align: "center" });
    });
  }
  unduh(doc, `${invoice ? "Invoice" : "Surat Jalan"} ${k.nomor} ${k.outlet?.nama ?? ""}`);
}
