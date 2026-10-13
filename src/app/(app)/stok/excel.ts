// Template Excel stok/opname: unduh daftar bahan → isi di outlet → unggah kembali
import type ExcelJS from "exceljs";
import type { Bahan } from "./opname-view";

const HEAD = ["ID", "Kategori", "Bahan", "Isi per kemasan", "Satuan kemasan", "Satuan kecil", "Stok sistem (satuan kecil)", "Jumlah kemasan utuh", "Sisa terbuka (satuan kecil)"];

export async function unduhTemplate(outlet: string, bahan: Bahan[]) {
  const { Workbook } = (await import("exceljs")).default;
  const wb = new Workbook();
  const ws = wb.addWorksheet("Opname");
  ws.addRow([`TEMPLATE STOK / OPNAME ${outlet.toUpperCase()}`]).font = { bold: true, size: 13 };
  ws.addRow(["Isi kolom H (kemasan utuh) dan I (sisa terbuka). Jangan ubah kolom ID. Kosongkan bahan yang tidak dihitung, isi 0 bila habis."]);
  const h = ws.addRow(HEAD);
  h.font = { bold: true };
  h.eachCell((c, i) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: i >= 8 ? "FFC6EFCE" : "FFFFDE85" } }));
  for (const b of bahan) ws.addRow([b.id, b.kategori ?? "", b.nama, b.konversi, b.satuan_beli, b.satuan_pakai, Math.round(b.sistem * 100) / 100, null, null]);
  [8, 14, 32, 12, 14, 12, 18, 18, 22].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  ws.getColumn(1).hidden = true;
  ws.views = [{ state: "frozen", ySplit: 3 }];
  const blob = new Blob([await wb.xlsx.writeBuffer()], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `Template Opname ${outlet}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

const nilai = (v: ExcelJS.CellValue): string => {
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && "result" in v) return nilai(v.result as ExcelJS.CellValue);
  return String(v).trim();
};

export async function bacaTemplate(buf: ArrayBuffer, bahan: Bahan[]) {
  const { Workbook } = (await import("exceljs")).default;
  const wb = new Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.worksheets[0];
  const byId = new Map(bahan.map((b) => [b.id, b]));
  const byNama = new Map(bahan.map((b) => [b.nama.toLowerCase(), b]));
  const isi: Record<string, { kemasan: string; eceran: string }> = {};
  let lewat = 0;
  ws.eachRow((row, n) => {
    if (n <= 3) return;
    const v = (row.values as ExcelJS.CellValue[]).slice(1);
    const k = nilai(v[7]), e = nilai(v[8]);
    if (!k && !e) return;
    const b = byId.get(nilai(v[0])) ?? byNama.get(nilai(v[2]).toLowerCase());
    if (!b) return void lewat++;
    isi[b.id] = { kemasan: k.replace(",", "."), eceran: e.replace(",", ".") };
  });
  return { isi, lewat };
}
