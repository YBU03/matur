// Impor laporan keuangan dari PDF format Ruma (hasil cetak sheet "Laporan Keuangan").
// Murni & diuji: teks PDF (posisi per potongan teks) → grid sel → parseLaporan yang sama dengan impor Excel.
import { parseLaporan, type Grid, type LaporanImpor, type Sel } from "./ruma-excel";

export type ItemPdf = { halaman: number; x: number; y: number; teks: string };
export type CekPdf = { totalPenjualan: number | null; hpp: number | null; labaKotor: number | null; labaBersih: number | null };

const RE_ANGKA = /^[\s(]*-?\s*\(?\s*(?:Rp)?\s*\(?\s*([\d.]+(?:,\d+)?)\s*\)?\s*-?\s*(?:\([+-]\))?\s*(?:-?\s*Rp)?\s*$/i;

/** Nilai satu potongan teks: angka rupiah (format akuntansi "-Rp 1.234-", "(62.200)"), "-" = 0, atau teks. */
export function selPdf(t: string): Sel | undefined {
  const s = t.replace(/\s+/g, " ").trim().replace(/^·\s*/, "");
  if (!s || /^\(?[+-]\)?$/.test(s) && s !== "-") return undefined;
  if (/^[-(]*\s*Rp\s*[-)]*$/i.test(s) || s === "(") return undefined;
  if (/^-+$/.test(s) || /^-\s+-$/.test(s)) return 0;
  // nomor rekening / angka panjang tanpa titik tetap teks
  if (/^\d{6,}$/.test(s)) return s;
  const m = s.match(RE_ANGKA);
  if (m && /\d/.test(m[1]) && (/[.,]/.test(m[1]) || /Rp|-|\(/i.test(s) || m[1].length <= 5)) {
    const n = Number(m[1].replace(/\./g, "").replace(",", "."));
    if (Number.isFinite(n)) return /\(\s*(?:Rp)?\s*[\d.]/.test(s) && /\)/.test(s) ? -n : n;
  }
  return s;
}

/** Kelompokkan potongan teks per baris (halaman + posisi vertikal), urut kiri ke kanan. */
export function gridDariPdf(items: ItemPdf[]): Grid {
  const urut = [...items].filter((i) => i.teks.trim()).sort((a, b) => a.halaman - b.halaman || b.y - a.y || a.x - b.x);
  const baris: ItemPdf[][] = [];
  for (const it of urut) {
    const akhir = baris[baris.length - 1];
    if (akhir && akhir[0].halaman === it.halaman && Math.abs(akhir[0].y - it.y) <= 2.5) akhir.push(it);
    else baris.push([it]);
  }
  return baris.map((r) =>
    r
      .sort((a, b) => a.x - b.x)
      .map((i) => selPdf(i.teks))
      .filter((v): v is Sel => v !== undefined),
  );
}

const norm = (v: Sel) => (v === null || v === undefined ? "" : String(v).toLowerCase().replace(/\s+/g, " ").trim());
const angka = (v: Sel) => (typeof v === "number" ? v : null);
const nilaiKanan = (row: Sel[]) => {
  const xs = row.map(angka).filter((x): x is number => x !== null);
  return xs.length ? xs[xs.length - 1] : null;
};

/** Tabel "Penerimaan Transfer" versi PDF: baris "1 Keterangan", jumlah, no rekening, atas nama (bank). */
function transferPdf(g: Grid): LaporanImpor["transfer"] {
  const r0 = g.findIndex((row) => row.some((c) => /penerimaan transfer/.test(norm(c))));
  if (r0 < 0) return [];
  let bankDefault: string | null = null;
  const hasil: LaporanImpor["transfer"] = [];
  for (let r = r0 + 1; r < Math.min(r0 + 60, g.length); r++) {
    const row = g[r] ?? [];
    const pertama = norm(row[0]);
    if (/^total/.test(pertama)) break;
    if (row.length === 1 && typeof row[0] === "string" && /^[A-Z]{2,10}$/.test(row[0].trim())) {
      bankDefault = row[0].trim();
      continue;
    }
    const m = typeof row[0] === "string" ? row[0].trim().match(/^(\d{1,2})\s+(.+)$/) : null;
    if (!m) continue;
    const jumlah = row.map(angka).find((x): x is number => x !== null) ?? 0;
    const rek = (row.find((c) => typeof c === "string" && /^\d{6,}$/.test(c.trim())) as string | undefined)?.trim() ?? null;
    let an: string | null = null;
    if (rek) {
      const iRek = row.findIndex((c) => c === rek || (typeof c === "string" && c.trim() === rek));
      an = (row.slice(iRek + 1).find((c) => typeof c === "string" && c.trim()) as string | undefined)?.trim() ?? null;
    }
    let bank = rek ? bankDefault : null;
    const b = an?.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
    if (b) {
      an = b[1].trim();
      bank = b[2].trim();
    }
    hasil.push({ keterangan: m[2].trim(), jumlah: Math.round(Math.abs(jumlah)), bank, no_rekening: rek, atas_nama: an });
  }
  return hasil;
}

/** Angka total yang tertulis di PDF, untuk dicocokkan dengan hasil hitung Matoer. */
function cekPdf(g: Grid): CekPdf {
  const cari = (re: RegExp) => {
    const row = g.find((r) => re.test(norm(r[0])) && nilaiKanan(r) !== null);
    const v = row ? nilaiKanan(row) : null;
    return v === null ? null : Math.round(v);
  };
  return {
    totalPenjualan: cari(/^total penjualan/),
    hpp: cari(/^harga pokok penjualan/),
    labaKotor: cari(/^laba kotor/),
    labaBersih: cari(/^laba bersih/),
  };
}

/** Baca potongan teks PDF laporan Ruma menjadi data laporan + angka total untuk pengecekan. */
export function parseLaporanPdf(items: ItemPdf[]): { laporan: LaporanImpor; cek: CekPdf } {
  const g = gridDariPdf(items);
  const laporan = parseLaporan(g);
  return { laporan: { ...laporan, transfer: transferPdf(g) }, cek: cekPdf(g) };
}
