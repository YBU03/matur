import type { jsPDF } from "jspdf";
import { LABEL } from "./laporan-pos";

export type BarisPenjualan = Record<string, unknown>;
const rupiah = (v: unknown) => `Rp ${Number(v ?? 0).toLocaleString("id-ID")}`;
const teks = (v: unknown) => (v == null || v === "" ? "-" : String(v));
const waktu = (v: unknown) =>
  v
    ? new Date(String(v)).toLocaleString("id-ID", {
        timeZone: "Asia/Jakarta",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";
export const KOLOM_PENJUALAN = [
  "Tanggal / jam",
  "No. transaksi",
  "Outlet",
  "Nomor ref",
  "Pelanggan",
  "Produk",
  "Qty",
  "Subtotal",
  "Diskon per bill",
  "Pajak",
  "Service charge",
  "Penyesuaian",
  "Total",
  "Dibayar",
  "Terakhir dibayar",
  "Sisa tagihan",
  "Status",
  "Pembayaran",
];
export function barisPenjualanPdf(r: BarisPenjualan) {
  return [
    waktu(r.waktu),
    teks(r.nomor_sumber ?? r.nomor),
    teks(r.outlet),
    teks(r.ref),
    teks(r.pelanggan),
    teks(r.item),
    teks(r.qty),
    rupiah(r.subtotal),
    rupiah(r.diskon),
    rupiah(r.pajak),
    rupiah(r.service_charge),
    rupiah(r.penyesuaian),
    rupiah(r.total),
    rupiah(r.dibayar),
    /^\d{4}-\d{2}-\d{2}$/.test(String(r.terakhir_dibayar ?? ""))
      ? String(r.terakhir_dibayar).split("-").reverse().join("/")
      : waktu(r.terakhir_dibayar),
    rupiah(r.sisa),
    LABEL[String(r.status)] ?? teks(r.status),
    teks(
      r.metode_sumber ??
        String(r.metode ?? "")
          .split(" + ")
          .map((x) => LABEL[x] ?? x)
          .join(" + "),
    ),
  ];
}
export function totalPenjualan(rows: BarisPenjualan[]) {
  const lunas = rows.filter((r) => r.status === "lunas");
  const sum = (k: string) => lunas.reduce((n, r) => n + Number(r[k] ?? 0), 0);
  return {
    transaksi: lunas.length,
    qty: sum("qty"),
    total: sum("total"),
    dibayar: sum("dibayar"),
    sisa: sum("sisa"),
    diskon: sum("diskon"),
    penyesuaian: sum("penyesuaian"),
    subtotal: sum("subtotal"),
    pajak: sum("pajak"),
    service: sum("service_charge"),
  };
}

/** A3 landscape: seluruh 18 kolom tetap terbaca, header berulang dan baris tidak terpotong. */
export async function buatLaporanPenjualanPdf(p: {
  rows: BarisPenjualan[];
  outlet: string;
  dari: string;
  sampai: string;
  simulasi?: boolean;
  logo?: string;
}): Promise<jsPDF> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3" });
  const W = doc.internal.pageSize.getWidth(),
    H = doc.internal.pageSize.getHeight();
  const t = totalPenjualan(p.rows);
  const title = p.simulasi
    ? "LAPORAN PENJUALAN - SIMULASI"
    : "LAPORAN PENJUALAN";
  const periode = `${p.dari.split("-").reverse().join("/")} - ${p.sampai.split("-").reverse().join("/")}`;
  const header = () => {
    doc.setFillColor(255, 248, 231).rect(0, 0, W, 35, "F");
    if (p.logo) doc.addImage(p.logo, "PNG", 12, 7, 19, 19);
    doc
      .setTextColor(74, 40, 20)
      .setFont("helvetica", "bold")
      .setFontSize(19)
      .text("MATOER", p.logo ? 35 : 12, 15);
    doc
      .setFontSize(8)
      .setFont("helvetica", "normal")
      .text("CV. Hazna Berkah Indonesia", p.logo ? 35 : 12, 21);
    doc
      .setFontSize(14)
      .setFont("helvetica", "bold")
      .text(title, W - 12, 13, { align: "right" });
    doc
      .setFontSize(9)
      .setFont("helvetica", "normal")
      .text(`${p.outlet} | ${periode}`, W - 12, 21, { align: "right" });
    doc.setDrawColor(244, 170, 46).line(12, 30, W - 12, 30);
  };
  const foot = [
    "TOTAL",
    String(t.transaksi) + " lunas",
    "",
    "",
    "",
    "",
    String(t.qty),
    rupiah(t.subtotal),
    rupiah(t.diskon),
    rupiah(t.pajak),
    rupiah(t.service),
    rupiah(t.penyesuaian),
    rupiah(t.total),
    rupiah(t.dibayar),
    "",
    rupiah(t.sisa),
    "",
    "",
  ];
  // widths total 396 mm on A3 (420 mm), 12 mm margins.
  const widths = [
    25, 19, 24, 25, 20, 49, 9, 22, 20, 16, 17, 20, 23, 23, 25, 20, 16, 23,
  ];
  autoTable(doc, {
    head: [KOLOM_PENJUALAN],
    body: p.rows.map(barisPenjualanPdf),
    foot: [foot],
    showFoot: "lastPage",
    startY: 37,
    margin: { top: 37, left: 12, right: 12, bottom: 20 },
    styles: {
      font: "helvetica",
      fontSize: 7,
      cellPadding: 2,
      overflow: "linebreak",
      textColor: [61, 41, 29],
      lineColor: [237, 225, 207],
      lineWidth: 0.12,
    },
    headStyles: { fillColor: [91, 50, 27], textColor: 255, fontSize: 7 },
    footStyles: {
      fillColor: [255, 232, 179],
      textColor: [61, 41, 29],
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [255, 251, 241] },
    columnStyles: Object.fromEntries(
      widths.map((w, i) => [
        i,
        {
          cellWidth: w,
          halign: i >= 6 && i <= 15 && i !== 14 ? "right" : "left",
        },
      ]),
    ),
    rowPageBreak: "avoid",
    didDrawPage: header,
  });
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7).setFont("helvetica", "normal").setTextColor(110);
    doc.text(
      "Dokumen Matoer | Waktu transaksi WIB | Total mencakup status yang ditampilkan; void tidak dihitung sebagai omzet.",
      12,
      H - 12,
    );
    if (p.rows.some((r) => r.sumber))
      doc.text(
        "Transaksi impor mengikuti rincian dokumen sumber; alokasi qty/harga per produk dan HPP tidak tersedia.",
        12,
        H - 8,
      );
    doc.text(`${i} / ${pages}`, W - 12, H - 8, { align: "right" });
  }
  return doc;
}
