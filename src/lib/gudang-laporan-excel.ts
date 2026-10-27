// Ekspor Excel (.xlsx) laporan Gudang: Laba Rugi (4 sheet) dan Stok Opname.
import type ExcelJS from "exceljs";
import { ringkasGudang, type GudangLaporan } from "./gudang-laporan";
import type { DraftGudang, HitungGudang } from "@/app/(app)/gudang/opname/view";

const RP = '"Rp" #,##0;[Red]-"Rp" #,##0;"Rp" 0';
const ANGKA = "#,##0.###;[Red]-#,##0.###;0";
const KEPALA: Partial<ExcelJS.Fill> = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFDE7C8" } };
const TOTAL: Partial<ExcelJS.Fill> = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } };

function judul(ws: ExcelJS.Worksheet, teks: string, sub: string[]) {
  ws.addRow([teks]).font = { bold: true, size: 14 };
  for (const s of sub) ws.addRow([s]).font = { size: 9, color: { argb: "FF666666" } };
  ws.addRow([]);
}
function tabel(ws: ExcelJS.Worksheet, head: string[], lebar: number[]) {
  const h = ws.addRow(head);
  h.font = { bold: true };
  h.eachCell((c) => {
    c.fill = KEPALA as ExcelJS.Fill;
    c.border = { bottom: { style: "thin" } };
  });
  lebar.forEach((w, i) => (ws.getColumn(i + 1).width = w));
  ws.views = [{ state: "frozen", ySplit: h.number }];
  return h.number;
}
function format(ws: ExcelJS.Worksheet, dari: number, kolom: Record<number, string>) {
  ws.eachRow((row, n) => {
    if (n <= dari) return;
    for (const [k, f] of Object.entries(kolom)) row.getCell(Number(k)).numFmt = f;
  });
}
const tgl = (iso: string) =>
  new Date(iso.length === 10 ? iso + "T00:00:00+07:00" : iso).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "2-digit", year: "numeric" });

export async function buatLabaExcel(d: GudangLaporan, awal: string, akhir: string, filter: string, namaOutlet: Record<string, string> = {}) {
  const { Workbook } = (await import("exceljs")).default;
  const wb = new Workbook();
  const r = ringkasGudang(d);
  const sub = [`Periode ${tgl(awal)} s.d. ${tgl(akhir)} · ${filter}`, "Laporan manajemen gudang berdasarkan barang baik yang diterima outlet. HPP dikunci saat pengiriman."];

  const ws = wb.addWorksheet("Ringkasan");
  judul(ws, "LABA RUGI GUDANG", sub);
  const mulai = tabel(ws, ["Uraian", "Nilai"], [42, 20]);
  const baris: [string, number, boolean?][] = [
    ["Penjualan diterima", r.penjualan],
    ["  dikurangi HPP diketahui", -r.hpp],
    ["Laba kotor diketahui", r.labaKotor, true],
    ["  dikurangi Biaya operasional", -r.biaya],
    ["  Penyesuaian invoice", r.invoice],
    ["  Penyesuaian stok diketahui", r.penyesuaian],
    ["LABA / RUGI DIKETAHUI", r.laba, true],
  ];
  for (const [l, v, tebal] of baris) {
    const row = ws.addRow([l, v]);
    if (tebal) {
      row.font = { bold: true };
      row.eachCell((c) => (c.fill = TOTAL as ExcelJS.Fill));
    }
  }
  ws.addRow([]);
  ws.addRow(["Info tambahan"]).font = { bold: true };
  ws.addRow(["Penjualan dengan HPP belum lengkap", r.penjualanBelum]);
  ws.addRow(["Termasuk penjualan internal Pusat", r.pusat]);
  ws.addRow(["Baris HPP belum lengkap", r.belum]).getCell(2).numFmt = "0";
  format(ws, mulai, { 2: RP });
  ws.lastRow!.getCell(2).numFmt = "0";
  ws.addRow([]);
  ws.addRow(["Margin internal Pusat bukan laba konsolidasi. Biaya umum tidak dialokasikan saat filter outlet/bahan."]).font = { italic: true, size: 9 };

  const wp = wb.addWorksheet("Penjualan");
  judul(wp, "RINCIAN PENJUALAN GUDANG", sub);
  const mp = tabel(wp, ["Tanggal", "Kiriman", "Outlet", "Kepemilikan", "Bahan", "Qty", "Harga jual", "Penjualan", "HPP", "Margin", "Status HPP"], [12, 20, 24, 12, 28, 9, 14, 16, 16, 16, 14]);
  for (const x of d.rows) {
    const jual = Math.round(Number(x.qty) * Number(x.harga));
    const hpp = x.hpp_gudang === null ? null : Number(x.qty) * Number(x.hpp_gudang);
    wp.addRow([tgl(x.waktu), x.nomor, x.outlet, x.kepemilikan, x.nama, Number(x.qty), Number(x.harga), jual, hpp, hpp === null ? null : jual - hpp, hpp === null ? "Belum lengkap" : "Lengkap"]);
  }
  const tp = wp.addRow(["TOTAL", "", "", "", "", null, null, r.penjualan, r.hpp, r.labaKotor, ""]);
  tp.font = { bold: true };
  tp.eachCell((c) => (c.fill = TOTAL as ExcelJS.Fill));
  format(wp, mp, { 6: ANGKA, 7: RP, 8: RP, 9: RP, 10: RP });

  const wbiaya = wb.addWorksheet("Biaya");
  judul(wbiaya, "BIAYA OPERASIONAL GUDANG", sub);
  const mb = tabel(wbiaya, ["Tanggal", "Keterangan", "Alokasi", "Nominal"], [12, 44, 18, 16]);
  for (const b of d.biaya) wbiaya.addRow([tgl(b.tanggal), b.keterangan, b.outlet_id ? (namaOutlet[b.outlet_id] ?? "Outlet") : "Biaya umum", Number(b.jumlah)]);
  const tb = wbiaya.addRow(["TOTAL", "", "", r.biaya]);
  tb.font = { bold: true };
  tb.eachCell((c) => (c.fill = TOTAL as ExcelJS.Fill));
  format(wbiaya, mb, { 4: RP });

  const wi = wb.addWorksheet("Penyesuaian");
  judul(wi, "PENYESUAIAN INVOICE & STOK", sub);
  const mi = tabel(wi, ["Jenis", "Tanggal", "Referensi", "Outlet / Bahan", "Nilai", "Keterangan"], [14, 12, 20, 26, 16, 44]);
  for (const x of d.invoice ?? []) wi.addRow(["Invoice", tgl(x.tanggal), x.nomor, x.outlet, Number(x.nilai), x.keterangan]);
  for (const m of d.mutasi) wi.addRow(["Stok", tgl(m.tanggal), m.jenis, m.nama, m.hpp === null ? null : Number(m.jumlah) * Number(m.hpp), m.hpp === null ? "HPP belum lengkap" : ""]);
  const ti = wi.addRow(["TOTAL", "", "", "", r.invoice + r.penyesuaian, ""]);
  ti.font = { bold: true };
  ti.eachCell((c) => (c.fill = TOTAL as ExcelJS.Fill));
  format(wi, mi, { 5: RP });
  return wb;
}

export async function buatOpnameExcel(d: DraftGudang, items: HitungGudang[]) {
  const { Workbook } = (await import("exceljs")).default;
  const wb = new Workbook();
  const ws = wb.addWorksheet("Opname");
  judul(ws, "STOK OPNAME GUDANG", [`Tanggal ${tgl(d.tanggal)} · Status ${d.status.toUpperCase()} · Petugas ${d.nama_petugas}`, `Catatan: ${d.catatan || "-"}`, "Isian fisik kosong = belum dihitung dan tidak mengubah stok. Hanya opname FINAL yang menyesuaikan stok."]);
  const m = tabel(ws, ["Bahan", "Satuan", "Stok sistem", "Fisik", "Selisih", "HPP / satuan", "Nilai selisih", "Alasan"], [30, 10, 14, 14, 12, 14, 16, 36]);
  let total = 0;
  for (const i of items) {
    const sel = i.fisik === null ? null : Number(i.fisik) - Number(i.sistem);
    const nilai = sel === null || i.hpp === null ? null : sel * Number(i.hpp);
    total += nilai ?? 0;
    const row = ws.addRow([i.nama, i.satuan, Number(i.sistem), i.fisik === null ? "Belum dihitung" : Number(i.fisik), sel, i.hpp === null ? null : Number(i.hpp), nilai, i.alasan || ""]);
    if (i.fisik === null) row.getCell(4).font = { italic: true, color: { argb: "FF999999" } };
  }
  const t = ws.addRow(["TOTAL", "", null, null, null, null, total, `${items.filter((i) => i.fisik !== null).length} dari ${items.length} bahan dihitung`]);
  t.font = { bold: true };
  t.eachCell((c) => (c.fill = TOTAL as ExcelJS.Fill));
  format(ws, m, { 3: ANGKA, 4: ANGKA, 5: ANGKA, 6: RP, 7: RP });
  return wb;
}

export async function unduhExcel(wb: ExcelJS.Workbook, nama: string) {
  const blob = new Blob([await wb.xlsx.writeBuffer()], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nama.replace(/[\\/:*?"<>|]+/g, " ").trim() + ".xlsx";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
