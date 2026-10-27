import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { ringkasGudang, type GudangLaporan } from "./gudang-laporan";
import type { DraftGudang, HitungGudang } from "@/app/(app)/gudang/opname/view";
const uang = (v: number) => "Rp " + Math.round(v).toLocaleString("id-ID");
function header(doc: jsPDF, title: string, sub: string) {
  doc.setFont("helvetica", "bold").setFontSize(13).text(title, 14, 16);
  doc.setFont("helvetica", "normal").setFontSize(8).text(sub, 14, 22);
}
function footer(doc: jsPDF) {
  for (let p = 1; p <= doc.getNumberOfPages(); p++) {
    doc.setPage(p);
    doc
      .setFont("helvetica", "normal")
      .setFontSize(8)
      .text(`Matoer - Halaman ${p}/${doc.getNumberOfPages()}`, 14, 290);
  }
}
export function buatOpnamePDF(d: DraftGudang, items: HitungGudang[]) {
  const doc = new jsPDF();
  header(
    doc,
    "STOK OPNAME GUDANG",
    `${d.tanggal} | ${d.status.toUpperCase()} | Petugas: ${d.nama_petugas}`,
  );
  autoTable(doc, {
    startY: 28,
    margin: { top: 28, bottom: 15 },
    styles: { fontSize: 8 },
    headStyles: { fillColor: 235, textColor: 0 },
    head: [["Bahan", "Satuan", "Sistem", "Fisik", "Selisih", "Alasan"]],
    body: items.map((i) => [
      i.nama,
      i.satuan,
      String(Number(i.sistem)),
      i.fisik === null ? "Belum dihitung" : String(Number(i.fisik)),
      i.fisik === null ? "-" : String(Number(i.fisik) - Number(i.sistem)),
      i.alasan,
    ]),
    didDrawPage: () =>
      header(
        doc,
        "STOK OPNAME GUDANG",
        `${d.tanggal} | ${d.status.toUpperCase()} | Petugas: ${d.nama_petugas}`,
      ),
  });
  const y = (doc as unknown as { lastAutoTable: { finalY: number } })
    .lastAutoTable.finalY;
  autoTable(doc, {
    startY: y + 5,
    margin: { top: 28, bottom: 15 },
    theme: "plain",
    styles: { fontSize: 8 },
    body: [
      ["Catatan", d.catatan || "-"],
      [
        "Informasi",
        "Isian kosong berarti belum dihitung. Hanya opname FINAL yang menyesuaikan stok.",
      ],
    ],
    didDrawPage: () =>
      header(
        doc,
        "STOK OPNAME GUDANG",
        `${d.tanggal} | ${d.status.toUpperCase()}`,
      ),
  });
  footer(doc);
  return doc;
}
export function buatLabaPDF(
  d: GudangLaporan,
  awal: string,
  akhir: string,
  filter: string,
) {
  const doc = new jsPDF();
  const r = ringkasGudang(d);
  const sub = `${awal} s.d. ${akhir} | ${filter}`;
  header(doc, "LABA RUGI GUDANG", sub);
  autoTable(doc, {
    startY: 28,
    margin: { top: 28, bottom: 15 },
    styles: { fontSize: 8 },
    headStyles: { fillColor: 235, textColor: 0 },
    head: [["Ringkasan", "Nilai"]],
    body: [
      ["Penjualan diterima", uang(r.penjualan)],
      ["HPP diketahui", uang(r.hpp)],
      ["Laba kotor diketahui", uang(r.labaKotor)],
      ["Biaya operasional", uang(r.biaya)],
      ["Penyesuaian stok diketahui", uang(r.penyesuaian)],
      ["Penyesuaian invoice", uang(r.invoice)],
      ["Laba / kontribusi diketahui", uang(r.laba)],
      ["Penjualan HPP belum lengkap", uang(r.penjualanBelum)],
      ["Termasuk internal Pusat", uang(r.pusat)],
      [
        "Catatan",
        `${r.belum} baris HPP belum lengkap. Margin internal Pusat bukan laba konsolidasi. Biaya umum tidak dialokasikan saat filter outlet/bahan.`,
      ],
    ],
    didDrawPage: () => header(doc, "LABA RUGI GUDANG", sub),
  });
  let y =
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
      .finalY + 5;
  autoTable(doc, {
    startY: y,
    margin: { top: 28, bottom: 15 },
    styles: { fontSize: 7 },
    headStyles: { fillColor: 235, textColor: 0 },
    head: [["Kiriman / Outlet", "Bahan", "Qty", "Penjualan", "HPP", "Margin"]],
    body: d.rows.map((x) => [
      x.nomor + " / " + x.outlet,
      x.nama,
      String(x.qty),
      uang(Number(x.qty) * Number(x.harga)),
      x.hpp_gudang === null
        ? "Belum lengkap"
        : uang(Number(x.qty) * Number(x.hpp_gudang)),
      x.hpp_gudang === null
        ? "Belum lengkap"
        : uang(Number(x.qty) * (Number(x.harga) - Number(x.hpp_gudang))),
    ]),
    didDrawPage: () => header(doc, "LABA RUGI GUDANG", sub),
  });
  y =
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
      .finalY + 5;
  autoTable(doc, {
    startY: y,
    margin: { top: 28, bottom: 15 },
    styles: { fontSize: 8 },
    headStyles: { fillColor: 235, textColor: 0 },
    head: [["Tanggal", "Biaya operasional", "Nominal"]],
    body: d.biaya.map((b) => [b.tanggal, b.keterangan, uang(Number(b.jumlah))]),
    didDrawPage: () => header(doc, "LABA RUGI GUDANG", sub),
  });
  if (d.invoice?.length) {
    y =
      (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
        .finalY + 5;
    autoTable(doc, {
      startY: y,
      margin: { top: 28, bottom: 15 },
      styles: { fontSize: 8 },
      headStyles: { fillColor: 235, textColor: 0 },
      head: [["Penyesuaian invoice", "Outlet", "Nilai", "Alasan"]],
      body: d.invoice.map((x) => [
        x.nomor,
        x.outlet,
        uang(Number(x.nilai)),
        x.keterangan,
      ]),
      didDrawPage: () => header(doc, "LABA RUGI GUDANG", sub),
    });
  }
  footer(doc);
  return doc;
}
