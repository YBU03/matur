// Import/export rincian keperluan proyek (dipakai di browser).
// Import mengenali dua bentuk file:
//  1. File hasil export Matur (sheet "Rincian Keperluan", kolom Kelompok…Keterangan)
//  2. Format "Daftar Material dan Harga": sheet material per bagian, sheet interior, sheet tukang.

import type ExcelJS from "exceljs";

export type RabRow = {
  kategori: string; // kelompok: Material / Keperluan Interior / Pertukangan / …
  bagian: string | null;
  nama: string;
  spesifikasi: string | null;
  qty: number;
  satuan: string | null;
  harga_satuan: number | null;
  harga_estimasi: number; // total baris
  harga_realisasi: number | null;
  status: "rencana" | "dibeli" | "terpasang";
  keterangan: string | null;
};

export const KELOMPOK = ["Material", "Keperluan Interior", "Pertukangan", "Peralatan & Mesin", "Branding", "Lainnya"];

const HEADERS = ["Kelompok", "Bagian", "Nama Barang", "Spesifikasi", "Jumlah", "Satuan", "Harga Satuan", "Total Estimasi", "Realisasi", "Status", "Keterangan"];

function text(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    if ("result" in v) return text(v.result as ExcelJS.CellValue);
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if ("text" in v) return String(v.text);
    if (v instanceof Date) return v.toISOString().slice(0, 10);
  }
  return String(v).trim();
}

function num(v: ExcelJS.CellValue): number | null {
  const t = text(v).replace(/rp/i, "").replace(/\s/g, "");
  if (!t) return null;
  // "1.400.000" (format Indonesia) atau "1400000" / "0,5"
  const n = Number(/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t) ? t.replace(/\./g, "").replace(",", ".") : t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

const rowValues = (r: ExcelJS.Row) => (r.values as ExcelJS.CellValue[]).slice(1);

export async function parseWorkbook(buf: ArrayBuffer): Promise<{ rows: RabRow[]; notes: string[] }> {
  const { Workbook } = (await import("exceljs")).default;
  const wb = new Workbook();
  await wb.xlsx.load(buf);
  const rows: RabRow[] = [];
  const notes: string[] = [];

  for (const ws of wb.worksheets) {
    const all: { n: number; v: ExcelJS.CellValue[] }[] = [];
    ws.eachRow((r, n) => all.push({ n, v: rowValues(r) }));
    const headerIdx = all.findIndex((r) => r.v.some((c) => /nama barang|nama tukang|^kelompok$/i.test(text(c))));
    const header = headerIdx >= 0 ? all[headerIdx].v.map((c) => text(c).toLowerCase()) : [];
    const col = (...names: string[]) => header.findIndex((h) => names.some((n) => h.startsWith(n)));
    const before = rows.length;

    if (/grand total/i.test(ws.name)) {
      notes.push(`Sheet "${ws.name}" dilewati (ringkasan dihitung otomatis).`);
      continue;
    }

    if (header.includes("kelompok")) {
      // 1. format export Matur
      const c = Object.fromEntries(HEADERS.map((h) => [h, col(h.toLowerCase())]));
      for (const r of all.slice(headerIdx + 1)) {
        const nama = text(r.v[c["Nama Barang"]]);
        if (!nama || /^total/i.test(text(r.v[0]))) continue;
        const qty = num(r.v[c["Jumlah"]]) ?? 1;
        const hs = num(r.v[c["Harga Satuan"]]);
        const st = text(r.v[c["Status"]]).toLowerCase();
        rows.push({
          kategori: text(r.v[c["Kelompok"]]) || "Lainnya",
          bagian: text(r.v[c["Bagian"]]) || null,
          nama,
          spesifikasi: text(r.v[c["Spesifikasi"]]) || null,
          qty,
          satuan: text(r.v[c["Satuan"]]) || null,
          harga_satuan: hs,
          harga_estimasi: Math.round(num(r.v[c["Total Estimasi"]]) ?? (hs ?? 0) * qty),
          harga_realisasi: num(r.v[c["Realisasi"]]),
          status: st === "dibeli" || st === "terpasang" ? st : "rencana",
          keterangan: text(r.v[c["Keterangan"]]) || null,
        });
      }
    } else if (header.some((h) => h.startsWith("nama barang"))) {
      // 2a. daftar material: baris judul bagian (sel gabungan) lalu item; kolom Harga = total baris
      const cNama = col("nama barang"), cSpek = col("ukuran", "spesifikasi"), cQty = col("jumlah"), cSat = col("satuan");
      const cHarga = col("harga"), cKet = col("keterangan"), cBag = col("bagian");
      let bagian: string | null = null;
      for (const r of all.slice(headerIdx + 1)) {
        const first = text(r.v[0]);
        if (/^total/i.test(first)) {
          const sisa = all.filter((x) => x.n > r.n && x.v.some((c) => text(c))).length;
          if (sisa) notes.push(`"${ws.name}": ${sisa} baris di bawah TOTAL dilewati (mis. catatan warna cat).`);
          break;
        }
        const nama = text(r.v[cNama]);
        // baris judul bagian, mis. "KURSI PANJANG" (sel gabungan: kolom No tidak berisi angka)
        if (!nama || (first && isNaN(Number(first)))) {
          if (first && isNaN(Number(first))) bagian = first.replace(/\w\S*/g, (w) => w[0] + w.slice(1).toLowerCase());
          continue;
        }
        if (cBag >= 0 && text(r.v[cBag])) bagian = text(r.v[cBag]);
        rows.push({
          kategori: "Material",
          bagian,
          nama,
          spesifikasi: text(r.v[cSpek]) || null,
          qty: num(r.v[cQty]) ?? 1,
          satuan: text(r.v[cSat]) || null,
          harga_satuan: null,
          harga_estimasi: Math.round(num(r.v[cHarga]) ?? 0),
          harga_realisasi: null,
          status: "rencana",
          keterangan: text(r.v[cKet]) || null,
        });
      }
    } else if (header.some((h) => h.startsWith("nama tukang"))) {
      // 2b. tukang: hari pengerjaan × biaya harian
      const cNo = col("no"), cNama = col("nama tukang"), cHari = col("hari"), cBiaya = col("biaya"), cTot = col("total");
      for (const r of all.slice(headerIdx + 1)) {
        const hari = num(r.v[cHari]);
        if (hari === null) continue;
        const biaya = num(r.v[cBiaya]) ?? 0;
        rows.push({
          kategori: "Pertukangan",
          bagian: null,
          nama: text(r.v[cNama]) || `Tukang ${text(r.v[cNo]) || rows.length - before + 1}`,
          spesifikasi: null,
          qty: hari,
          satuan: "hari",
          harga_satuan: Math.round(biaya),
          harga_estimasi: Math.round(num(r.v[cTot]) ?? hari * biaya),
          harga_realisasi: null,
          status: "rencana",
          keterangan: null,
        });
      }
    } else {
      // 2c. daftar sederhana: Nama | Jumlah | Harga satuan | Total (judul di baris pertama)
      const judul = text(all[0]?.v[0]);
      const kelompok = /interior/i.test(judul + ws.name) ? "Keperluan Interior" : judul.replace(/^add on\s*/i, "") || ws.name;
      for (const r of all.slice(1)) {
        const nama = text(r.v[0]);
        const qty = num(r.v[1]);
        if (!nama || qty === null) continue;
        const hs = num(r.v[2]);
        rows.push({
          kategori: kelompok,
          bagian: null,
          nama,
          spesifikasi: null,
          qty,
          satuan: null,
          harga_satuan: hs === null ? null : Math.round(hs),
          harga_estimasi: Math.round(num(r.v[3]) ?? (hs ?? 0) * qty),
          harga_realisasi: null,
          status: "rencana",
          keterangan: null,
        });
      }
    }
    if (rows.length === before) notes.push(`Sheet "${ws.name}" tidak berisi item yang dikenali.`);
    else {
      // bandingkan dengan baris "Total" yang tertulis di file
      const totalRow = all.find((r) => r.v.some((c) => /^total$/i.test(text(c))));
      const tertulis = totalRow ? [...totalRow.v].reverse().map(num).find((n) => n !== null) : undefined;
      const hitung = rows.slice(before).reduce((s, r) => s + r.harga_estimasi, 0);
      if (tertulis !== undefined && tertulis !== null && Math.round(tertulis) !== hitung)
        notes.push(
          `⚠️ "${ws.name}": total tertulis di file ${rp(Math.round(tertulis))}, hasil penjumlahan item ${rp(hitung)} (selisih ${rp(Math.abs(hitung - Math.round(tertulis)))}). Mohon dicek rumus di file.`,
        );
    }
  }
  return { rows, notes };
}

export function groupRab<T extends Pick<RabRow, "kategori" | "harga_estimasi" | "harga_realisasi">>(items: T[]) {
  const order = (k: string) => (KELOMPOK.indexOf(k) + 1 || 99);
  const groups = new Map<string, T[]>();
  for (const it of items) groups.set(it.kategori, [...(groups.get(it.kategori) ?? []), it]);
  return [...groups.entries()]
    .sort((a, b) => order(a[0]) - order(b[0]))
    .map(([kelompok, list]) => ({
      kelompok,
      items: list,
      estimasi: list.reduce((s, i) => s + i.harga_estimasi, 0),
      realisasi: list.reduce((s, i) => s + (i.harga_realisasi ?? 0), 0),
    }));
}

const rp = (n: number | null) => (n ? "Rp " + new Intl.NumberFormat("id-ID").format(n) : "-");

export async function exportExcel(judul: string, items: RabRow[]) {
  const { Workbook } = (await import("exceljs")).default;
  const wb = new Workbook();
  const ws = wb.addWorksheet("Rincian Keperluan");
  ws.addRow([judul]).font = { bold: true, size: 14 };
  ws.addRow([]);
  const h = ws.addRow(HEADERS);
  h.font = { bold: true };
  h.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFDE85" } }));
  for (const i of items)
    ws.addRow([i.kategori, i.bagian, i.nama, i.spesifikasi, i.qty, i.satuan, i.harga_satuan, i.harga_estimasi, i.harga_realisasi, i.status, i.keterangan]);
  ws.addRow([]);
  for (const g of groupRab(items)) ws.addRow([`Total ${g.kelompok}`, null, null, null, null, null, null, g.estimasi, g.realisasi || null]).font = { bold: true };
  const all = groupRab(items).reduce((s, g) => [s[0] + g.estimasi, s[1] + g.realisasi], [0, 0]);
  ws.addRow(["GRAND TOTAL", null, null, null, null, null, null, all[0], all[1] || null]).font = { bold: true };
  [16, 18, 30, 18, 9, 10, 14, 16, 16, 11, 30].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  [7, 8, 9].forEach((c) => (ws.getColumn(c).numFmt = '"Rp" #,##0'));
  const blob = new Blob([await wb.xlsx.writeBuffer()], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  download(blob, `${judul}.xlsx`);
}

export async function exportPdf(judul: string, sub: string, items: RabRow[]) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.setFontSize(14).text(judul, 14, 14);
  doc.setFontSize(9).text(sub, 14, 20);
  let y = 26;
  const groups = groupRab(items);
  for (const g of groups) {
    autoTable(doc, {
      startY: y,
      head: [[g.kelompok, "Bagian", "Spesifikasi", "Jumlah", "Satuan", "Harga Satuan", "Total", "Realisasi", "Status", "Keterangan"]],
      body: g.items.map((i) => [i.nama, i.bagian ?? "", i.spesifikasi ?? "", String(i.qty), i.satuan ?? "", rp(i.harga_satuan), rp(i.harga_estimasi), rp(i.harga_realisasi), i.status, i.keterangan ?? ""]),
      foot: [[`Subtotal ${g.kelompok}`, "", "", "", "", "", rp(g.estimasi), rp(g.realisasi), "", ""]],
      styles: { fontSize: 7.5, cellPadding: 1.5 },
      headStyles: { fillColor: [255, 149, 0] },
      footStyles: { fillColor: [255, 239, 194], textColor: 20 },
      columnStyles: { 5: { halign: "right" }, 6: { halign: "right" }, 7: { halign: "right" } },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }
  autoTable(doc, {
    startY: y,
    head: [["Ringkasan", "Estimasi", "Realisasi"]],
    body: [
      ...groups.map((g) => [g.kelompok, rp(g.estimasi), rp(g.realisasi)]),
      ["GRAND TOTAL", rp(groups.reduce((s, g) => s + g.estimasi, 0)), rp(groups.reduce((s, g) => s + g.realisasi, 0))],
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [90, 52, 23] },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
    tableWidth: 120,
  });
  download(doc.output("blob"), `${judul}.pdf`);
}

function download(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name.replace(/[\\/:*?"<>|]/g, "-");
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
