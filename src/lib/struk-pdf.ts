// Struk POS → PDF selebar kertas thermal (58/80 mm), tata letak kolom sama dengan cetak Bluetooth.
import type { BarisStruk } from "./printer-bt";
import { asciiSaja } from "./printer-bt";

function lipat(s: string, lebar: number) {
  const out: string[] = [];
  let sisa = s;
  while (sisa.length > lebar) {
    const potong = sisa.lastIndexOf(" ", lebar) > lebar / 2 ? sisa.lastIndexOf(" ", lebar) : lebar;
    out.push(sisa.slice(0, potong).trimEnd());
    sisa = sisa.slice(potong).trimStart();
  }
  out.push(sisa);
  return out;
}

type Baris = { teks: string; tengah: boolean; tebal: boolean; besar: boolean };

/** Ubah baris struk menjadi baris teks berkolom tetap (32 kolom 58 mm, 48 kolom 80 mm). */
export function barisTeks(baris: BarisStruk[], kolom: number): Baris[] {
  const out: Baris[] = [];
  for (const b of baris) {
    const o = typeof b === "string" ? { teks: b } : b;
    const f = { tengah: !!o.tengah, tebal: !!o.tebal, besar: !!o.besar };
    const kol = o.besar ? Math.floor(kolom / 2) : kolom;
    if (o.kiriKanan) {
      const k = asciiSaja(o.kiriKanan[0]);
      const n = asciiSaja(o.kiriKanan[1]);
      lipat(k, Math.max(kol - n.length - 1, 8)).forEach((t, i) =>
        out.push({ ...f, teks: i === 0 ? t + " ".repeat(Math.max(kol - t.length - n.length, 1)) + n : "  " + t }),
      );
    } else for (const t of lipat(asciiSaja(o.teks), kol)) out.push({ ...f, teks: t });
  }
  return out;
}

export async function buatStrukPdf(baris: BarisStruk[], kertas: "58" | "80") {
  const { jsPDF } = await import("jspdf");
  const lebar = kertas === "58" ? 58 : 80;
  const kolom = kertas === "58" ? 32 : 48;
  const margin = kertas === "58" ? 4 : 5;
  const isi = lebar - 2 * margin;
  const fs = (isi / kolom / 0.6) * 2.835; // ukuran huruf Courier (pt) agar `kolom` karakter pas selebar isi
  const tinggiBaris = (fs / 2.835) * 1.35;
  const rows = barisTeks(baris, kolom);
  const tinggi = margin * 2 + rows.reduce((t, r) => t + tinggiBaris * (r.besar ? 2 : 1), 0) + 4;
  const h = Math.max(tinggi, 60);
  const doc = new jsPDF({ unit: "mm", format: [lebar, h], orientation: h >= lebar ? "portrait" : "landscape" });
  let y = margin;
  for (const r of rows) {
    const besar = r.besar ? 2 : 1;
    doc.setFont("courier", r.tebal ? "bold" : "normal").setFontSize(fs * besar);
    y += tinggiBaris * besar;
    if (r.tengah) doc.text(r.teks, lebar / 2, y - tinggiBaris * 0.3, { align: "center" });
    else doc.text(r.teks, margin, y - tinggiBaris * 0.3);
  }
  return doc;
}
