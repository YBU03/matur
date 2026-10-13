// Ekspor Catatan Harian ke Excel dengan susunan kolom seperti sheet "Transaksi" Ruma
import type { Biaya, Hari } from "./catatan-view";
import { KANAL } from "./catatan-view";

type Kat = { id: string; nama: string; grup: string; urutan: number };

export async function eksporExcel(outlet: string, bulan: string, hari: Hari[], biaya: Biaya[], kategori: Kat[]) {
  const { Workbook } = (await import("exceljs")).default;
  const wb = new Workbook();
  const ws = wb.addWorksheet("Transaksi");
  // urutan kolom pengeluaran: HPP dulu (es kristal, bahan baku, galon), lalu beban, lalu lain-lain
  const kat = [...kategori].sort((a, b) => ["hpp", "beban", "lain"].indexOf(a.grup) - ["hpp", "beban", "lain"].indexOf(b.grup) || a.urutan - b.urutan);
  const kanal = [...KANAL, ["diskon", "Discount"] as const];
  const head = ["Tanggal", "Keterangan", "Item", ...kanal.map(([, l]) => l), ...kat.map((k) => k.nama.replace(/^Biaya /, "")), "Penjualan Tunai", "Pengeluaran Laci", "Laba (Tunai)", "Aktual", "Selisih"];
  const judul = new Date(`${bulan}-01T00:00:00`).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  ws.addRow([`CATATAN HARIAN ${outlet.toUpperCase()}`]).font = { bold: true, size: 14 };
  ws.addRow([`Per ${judul}`]);
  ws.addRow([]);
  const h = ws.addRow(head);
  h.font = { bold: true };
  h.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFDE85" } }));
  const nK = 3 + kanal.length;
  const kol = (id: string) => nK + kat.findIndex((k) => k.id === id) + 1;
  const tot = new Array(head.length).fill(0);
  for (const d of hari) {
    const items = biaya.filter((b) => b.tanggal === d.tanggal);
    if (!items.length && !KANAL.some(([k]) => Number(d[k]))) continue;
    const laci = items.filter((b) => b.sumber === "laci").reduce((s, b) => s + b.jumlah, 0);
    const baris = new Array(head.length).fill(null);
    baris[0] = new Date(d.tanggal + "T00:00:00");
    baris[1] = d.shift > 1 ? `${d.shift} shift` : "Full Shift";
    kanal.forEach(([k], i) => (baris[3 + i] = Number(d[k as keyof Hari] ?? 0) || null));
    const L = head.length;
    baris[L - 5] = d.tunai || null;
    baris[L - 4] = laci || null;
    baris[L - 3] = d.tunai - laci;
    baris[L - 2] = d.setoran;
    baris[L - 1] = d.selisih;
    ws.addRow(baris).font = { bold: true };
    for (const b of items) {
      const r = new Array(head.length).fill(null);
      r[2] = `${b.keterangan ?? ""}${b.sumber === "pusat" ? " (pusat)" : ""}`.trim();
      r[kol(b.kategori_id) - 1] = b.jumlah;
      ws.addRow(r);
      tot[kol(b.kategori_id) - 1] += b.jumlah;
    }
    kanal.forEach(([k], i) => (tot[3 + i] += Number(d[k as keyof Hari] ?? 0)));
    tot[L - 5] += d.tunai;
    tot[L - 4] += laci;
    tot[L - 3] += d.tunai - laci;
    tot[L - 2] += d.setoran ?? 0;
    tot[L - 1] += d.selisih ?? 0;
  }
  ws.addRow([]);
  tot[0] = "Total";
  const t = ws.addRow(tot.map((v, i) => (i < 3 ? v || null : v || null)));
  t.font = { bold: true };
  t.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFEFC2" } }));
  ws.getColumn(1).numFmt = "dd/mm/yyyy";
  ws.getColumn(1).width = 12;
  ws.getColumn(2).width = 12;
  ws.getColumn(3).width = 28;
  for (let c = 4; c <= head.length; c++) {
    ws.getColumn(c).width = 13;
    ws.getColumn(c).numFmt = '#,##0;[Red]-#,##0';
  }
  ws.views = [{ state: "frozen", xSplit: 3, ySplit: 4 }];
  const blob = new Blob([await wb.xlsx.writeBuffer()], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `Catatan Harian ${outlet} ${bulan}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
