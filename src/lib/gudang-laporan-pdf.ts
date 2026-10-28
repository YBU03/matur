import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { ringkasGudang, type GudangLaporan } from "./gudang-laporan";
import type { DraftGudang, HitungGudang } from "@/app/(app)/gudang/opname/view";
const uang = (v: number) =>
  (v < 0 ? "-Rp " : "Rp ") + Math.abs(Math.round(v)).toLocaleString("id-ID");
const angka = (v: number) =>
  Number(v).toLocaleString("id-ID", { maximumFractionDigits: 3 });
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
    columnStyles: {
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
    },
    head: [
      [
        "Bahan",
        "Satuan",
        "Sistem",
        "Fisik",
        "Selisih",
        "Nilai selisih",
        "Alasan",
      ],
    ],
    body: [
      ...items.map((i) => {
        const sel =
          i.fisik === null ? null : Number(i.fisik) - Number(i.sistem);
        return [
          i.nama,
          i.satuan,
          angka(Number(i.sistem)),
          i.fisik === null ? "Belum dihitung" : angka(Number(i.fisik)),
          sel === null ? "-" : (sel > 0 ? "+" : "") + angka(sel),
          sel === null
            ? "-"
            : i.hpp === null
              ? "HPP belum ada"
              : uang(sel * Number(i.hpp)),
          i.alasan,
        ];
      }),
      [
        {
          content: `TOTAL · ${items.filter((i) => i.fisik !== null).length} dari ${items.length} bahan dihitung`,
          colSpan: 5,
          styles: { fontStyle: "bold" },
        },
        {
          content: uang(
            items.reduce(
              (n, i) =>
                n +
                (i.fisik === null || i.hpp === null
                  ? 0
                  : (Number(i.fisik) - Number(i.sistem)) * Number(i.hpp)),
              0,
            ),
          ),
          styles: { fontStyle: "bold", halign: "right" },
        },
        "",
      ],
    ],
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
    columnStyles: { 0: { cellWidth: 120 }, 1: { halign: "right" } },
    head: [
      [
        "Ringkasan laba rugi",
        { content: "Nilai", styles: { halign: "right" } },
      ],
    ],
    body: [
      ["Penjualan diterima (sebelum diskon)", uang(r.penjualan)],
      ["Diskon invoice", uang(-r.diskon)],
      ["Pajak invoice (bukan laba)", uang(r.pajak)],
      ["Total tagihan termasuk pajak", uang(r.tagihan)],
      ["Dokumen perlu ditinjau", String(r.perluTinjau)],
      ["   dikurangi HPP diketahui", uang(-r.hpp)],
      [
        { content: "Laba kotor diketahui", styles: { fontStyle: "bold" } },
        { content: uang(r.labaKotor), styles: { fontStyle: "bold" } },
      ],
      ["   dikurangi Biaya operasional", uang(-r.biaya)],
      ["   Penyesuaian invoice", uang(r.invoice)],
      ["   Penyesuaian stok diketahui", uang(r.penyesuaian)],
      [
        {
          content: "LABA / RUGI DIKETAHUI",
          styles: { fontStyle: "bold", fillColor: 238 },
        },
        {
          content: uang(r.laba),
          styles: { fontStyle: "bold", fillColor: 238 },
        },
      ],
      ["Info: penjualan HPP belum lengkap", uang(r.penjualanBelum)],
      ["Info: termasuk internal Pusat", uang(r.pusat)],
      [
        "Catatan",
        {
          content: `${r.belum} baris HPP belum lengkap. Margin internal Pusat bukan laba konsolidasi. Biaya umum tidak dialokasikan saat filter outlet/bahan.`,
          styles: { halign: "left" },
        },
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
