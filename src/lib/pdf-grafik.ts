// Grafik sederhana yang digambar langsung di jsPDF (tajam saat dicetak). Warna dari palet tervalidasi.
import type { jsPDF } from "jspdf";
import { SERIES, ringkas } from "./chart-utils";

export type RGB = [number, number, number];
export const rgb = (hex: string): RGB => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
export const WARNA = SERIES.map(rgb);
const INK: RGB = [41, 37, 36];
const INK2: RGB = [120, 113, 108];
const GRID: RGB = [231, 229, 228];
const rp = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(n));

/** Kartu KPI: label, nilai, dan perubahan vs bulan lalu (panah + teks, bukan warna saja). */
export function kpi(doc: jsPDF, x: number, y: number, w: number, label: string, nilai: number | string, delta?: number | null, sub?: string) {
  doc.setDrawColor(...GRID).setFillColor(255, 250, 242).roundedRect(x, y, w, 21, 2, 2, "FD");
  doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...INK2).text(label, x + 3, y + 5.5);
  doc.setFont("helvetica", "bold").setFontSize(11.5).setTextColor(...INK).text(typeof nilai === "string" ? nilai : rp(nilai), x + 3, y + 12);
  doc.setFont("helvetica", "normal").setFontSize(7);
  if (delta !== undefined && delta !== null) {
    const naik = delta >= 0;
    doc.setTextColor(...((naik ? [21, 128, 61] : [220, 38, 38]) as RGB)).text(`${naik ? "Naik" : "Turun"} ${Math.abs(delta).toFixed(1).replace(".", ",")}% vs bulan lalu`, x + 3, y + 17);
  } else if (sub) doc.setTextColor(...INK2).text(sub, x + 3, y + 17);
  doc.setTextColor(0);
}

/** Judul bagian dengan garis aksen. */
export function judul(doc: jsPDF, x: number, y: number, teks: string, sub?: string) {
  doc.setFillColor(...WARNA[1]).rect(x, y - 3.5, 1.2, 5, "F");
  doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(...INK).text(teks, x + 3, y);
  if (sub) doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...INK2).text(sub, x + 3, y + 4);
  doc.setTextColor(0);
}

/** Batang 100% bertumpuk + legenda bernilai (part-to-whole). */
export function bertumpuk(doc: jsPDF, x: number, y: number, w: number, bagian: { name: string; value: number; persen?: number }[]) {
  const total = bagian.reduce((s, b) => s + Math.max(b.value, 0), 0) || 1;
  let cx = x;
  bagian.forEach((b, i) => {
    const bw = (Math.max(b.value, 0) / total) * w;
    if (bw <= 0) return;
    doc.setFillColor(...WARNA[i % WARNA.length]).rect(cx, y, Math.max(bw - 0.6, 0.2), 8, "F");
    cx += bw;
  });
  bagian.forEach((b, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const lx = x + col * (w / 2), ly = y + 14 + row * 6;
    doc.setFillColor(...WARNA[i % WARNA.length]).rect(lx, ly - 2.6, 3, 3, "F");
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...INK).text(b.name, lx + 5, ly);
    // persen tetap (mis. sedekah 2,5% dari laba kotor) bila diberikan, selain itu porsi dari total
    const p = (b.persen ?? (Math.max(b.value, 0) / total) * 100).toFixed(1).replace(".", ",");
    doc.setFont("helvetica", "bold").text(`${p}%`, lx + w / 2 - 34, ly, { align: "right" });
    doc.setFont("helvetica", "normal").setTextColor(...INK2).text(rp(b.value), lx + w / 2 - 3, ly, { align: "right" });
  });
  doc.setTextColor(0);
  return y + 14 + Math.ceil(bagian.length / 2) * 6;
}

/** Batang horizontal dengan label nilai langsung (satu warna = besaran). */
export function batang(doc: jsPDF, x: number, y: number, w: number, data: { name: string; value: number }[], warna: RGB = WARNA[1], lw = 34) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const vw = 18, bw = w - lw - vw, maks = Math.floor(lw / 1.55);
  data.forEach((d, i) => {
    const yy = y + i * 6.5;
    doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...INK).text(d.name.length > maks ? d.name.slice(0, maks - 2) + "..." : d.name, x, yy + 3.2);
    doc.setFillColor(245, 245, 244).rect(x + lw, yy, bw, 4.2, "F");
    doc.setFillColor(...warna).roundedRect(x + lw, yy, Math.max((d.value / max) * bw, 0.8), 4.2, 0.8, 0.8, "F");
    doc.setTextColor(...INK2).text(ringkas(d.value), x + w, yy + 3.2, { align: "right" });
  });
  doc.setTextColor(0);
  return y + data.length * 6.5;
}

/** Kolom berkelompok per bulan (dua seri satuan sama, satu sumbu) + legenda. */
export function kolom(doc: jsPDF, x: number, y: number, w: number, h: number, data: { label: string; a: number; b: number }[], nama: [string, string]) {
  const max = Math.max(...data.flatMap((d) => [d.a, d.b]), 1);
  const base = y + h;
  // garis bantu tipis
  doc.setDrawColor(...GRID).setLineWidth(0.2);
  [0, 0.5, 1].forEach((t) => {
    const gy = base - t * h;
    doc.line(x + 12, gy, x + w, gy);
    doc.setFont("helvetica", "normal").setFontSize(6.5).setTextColor(...INK2).text(ringkas(max * t), x + 10, gy + 1, { align: "right" });
  });
  const slot = (w - 14) / Math.max(data.length, 1), cw = Math.min(7, slot / 3);
  data.forEach((d, i) => {
    const cx = x + 14 + i * slot + slot / 2;
    [d.a, d.b].forEach((v, j) => {
      const ch = (Math.max(v, 0) / max) * h;
      doc.setFillColor(...WARNA[j === 0 ? 0 : 3]).roundedRect(cx - cw - 0.3 + j * (cw + 0.6), base - ch, cw, ch, 0.8, 0.8, "F");
    });
    doc.setFontSize(7).setTextColor(...INK).text(d.label, cx, base + 4, { align: "center" });
  });
  [0, 1].forEach((j) => {
    const lx = x + 14 + j * 40;
    doc.setFillColor(...WARNA[j === 0 ? 0 : 3]).rect(lx, base + 7, 3, 3, "F");
    doc.setFontSize(7.5).setTextColor(...INK).text(nama[j], lx + 5, base + 9.6);
  });
  doc.setTextColor(0);
  return base + 12;
}

/** Nomor halaman & catatan kaki di semua halaman. */
export function kaki(doc: jsPDF, teks: string) {
  const n = doc.getNumberOfPages();
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setDrawColor(...GRID).setLineWidth(0.3).line(14, H - 12, W - 14, H - 12);
    doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(...INK2);
    doc.text(teks, 14, H - 8);
    doc.text(`Halaman ${i} dari ${n}`, W - 14, H - 8, { align: "right" });
  }
  doc.setTextColor(0);
}
