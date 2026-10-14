// Format Excel Ruma: sheet "Transaksi" (catatan harian) dan "Laporan Keuangan" (laporan bulanan resmi).
// Dipakai untuk ekspor (kolom) dan impor (baca grid sel). Murni & diuji.
import type { KanalHarian } from "./harian";

export type Sel = string | number | Date | boolean | null | undefined;
export type Grid = Sel[][];

// kolom pengeluaran Ruma + kata kunci pencocok nama kategori biaya di Matoer
export const KELUAR: [string, RegExp][] = [
  ["Es Kristal", /es kristal|es batu/],
  ["Bahan Baku", /bahan baku|dessert|snack|titip/],
  ["Biaya Galon", /galon/],
  ["Sewa Outlet", /sewa/],
  ["Listrik", /listrik|pln|token/],
  ["Internet", /internet|wifi|indihome/],
  ["Air", /^(biaya )?air|pdam/],
  ["Maintenance", /maintenance|servis|service/],
  ["B. Gaji", /gaji|upah|lembur/],
  ["Biaya Perlengkapan", /perlengkapan/],
  ["Biaya Pemeliharaan Lingkungan", /lingkungan|kebersihan|sampah|keamanan/],
  ["Biaya Lain-lain", /lain/],
  ["Reimburse", /reimburse/],
  ["Sedekah", /sedekah|donasi|infaq|zakat/],
  ["Distribusi", /distribusi|ongkir|kirim/],
  ["Marketing", /marketing|promosi|iklan|endorse|influencer/],
];
const LAIN = KELUAR.findIndex(([n]) => n === "Biaya Lain-lain");

/** Indeks kolom pengeluaran Ruma untuk sebuah nama kategori Matoer. */
export function kolomKategori(nama: string) {
  const n = nama.toLowerCase().trim();
  const i = KELUAR.findIndex(([, re]) => re.test(n));
  return i < 0 ? LAIN : i;
}

const norm = (v: Sel) => (v === null || v === undefined ? "" : String(v).toLowerCase().replace(/\s+/g, " ").trim());
const angka = (v: Sel): number | null => (typeof v === "number" && isFinite(v) ? v : typeof v === "string" && /^-?[\d.,]+$/.test(v.trim()) ? Number(v.replace(/\./g, "").replace(",", ".")) : null);
const tgl = (v: Sel): string | null => (v instanceof Date && !isNaN(v.getTime()) ? v.toISOString().slice(0, 10) : null);

/** Kategori Matoer untuk judul kolom pengeluaran Excel (mis. "Sewa Outlet" → "Biaya Sewa"). */
export function kategoriUntuk<K extends { id: string; nama: string }>(judul: string, kategori: K[]): K | null {
  const j = norm(judul).replace(/^b\. /, "biaya ");
  const tanpa = (s: string) => norm(s).replace(/^biaya /, "");
  const persis = kategori.find((k) => tanpa(k.nama) === j.replace(/^biaya /, ""));
  if (persis) return persis;
  const idx = KELUAR.findIndex(([n, re]) => norm(n) === norm(judul) || re.test(j));
  const cocok = idx >= 0 ? kategori.find((k) => kolomKategori(k.nama) === idx) : null;
  return cocok ?? kategori.find((k) => /lain/.test(norm(k.nama))) ?? null;
}

const KANAL_EXCEL: Record<string, KanalHarian> = {
  tunai: "tunai", "non tunai": "non_tunai", "go food": "gofood", gofood: "gofood", "grab food": "grabfood", grabfood: "grabfood",
  "tiktok go": "tiktok", tiktok: "tiktok", "ruma app": "ruma_app", "shopee food": "shopeefood", shopeefood: "shopeefood", discount: "diskon", diskon: "diskon", tumbler: "tumbler",
};

export type HariImpor = { tanggal: string; jual: Partial<Record<KanalHarian, number>>; biaya: { kolom: string; keterangan: string; jumlah: number }[] };

/** Baca sheet "Transaksi": baris bertanggal = penjualan per kanal (+ pengeluaran di baris itu), baris di bawahnya = item pengeluaran. */
export function parseTransaksi(g: Grid): { judul: string | null; hari: HariImpor[] } {
  const hr = g.findIndex((r) => r?.some((c) => norm(c) === "tunai"));
  if (hr < 0) throw new Error('Kolom "Tunai" tidak ditemukan — pastikan memakai sheet "Transaksi" format Ruma.');
  const jualKol = new Map<number, KanalHarian>();
  g[hr].forEach((c, i) => KANAL_EXCEL[norm(c)] && jualKol.set(i, KANAL_EXCEL[norm(c)]));
  const er = [hr - 1, hr - 2, hr].find((r) => r >= 0 && g[r]?.some((c) => norm(c) === "es kristal"));
  if (er === undefined) throw new Error('Kolom pengeluaran (mis. "Es Kristal") tidak ditemukan.');
  const mulai = g[er].findIndex((c) => norm(c) === "es kristal");
  const stop = g[hr].findIndex((c, i) => i > mulai && ["penjualan", "pengeluaran", "laba"].includes(norm(c)));
  const keluarKol = new Map<number, string>();
  for (let c = mulai; c < (stop < 0 ? Math.max(g[er].length, g[hr].length) : stop); c++) {
    const j = String(g[er][c] ?? g[hr][c] ?? "").trim();
    if (j) keluarKol.set(c, j);
  }
  const judul = g.slice(0, hr).flat().find((c) => typeof c === "string" && /laporan/i.test(c)) as string | undefined;
  const hari: HariImpor[] = [];
  let cur: HariImpor | null = null;
  let grup = "";
  for (let r = hr + 1; r < g.length; r++) {
    const row = g[r] ?? [];
    const t = tgl(row[0]);
    if (!t && /^(total|jumlah|grand)/.test(norm(row[0]))) break;
    if (t) {
      cur = { tanggal: t, jual: {}, biaya: [] };
      hari.push(cur);
      grup = "";
      for (const [c, k] of jualKol) {
        const v = angka(row[c]);
        if (v) cur.jual[k] = (cur.jual[k] ?? 0) + (k === "diskon" ? Math.abs(v) : v);
      }
    }
    if (!cur) continue;
    const ket = typeof row[2] === "string" ? row[2].trim() : "";
    const label = typeof row[1] === "string" ? row[1].trim() : "";
    let ada = false;
    for (const [c, kol] of keluarKol) {
      const v = angka(row[c]);
      if (!v) continue;
      ada = true;
      cur.biaya.push({ kolom: kol, keterangan: (t ? kol : ket || label || kol) + (grup && !t ? ` (${grup})` : ""), jumlah: Math.round(v) });
    }
    if (!t && !ada && label && !ket) grup = label; // judul kelompok, mis. "Pembelian Dessert dan Snack"
  }
  return { judul: judul ?? null, hari };
}

export type LaporanImpor = {
  periode: string | null;
  nama_outlet: string | null;
  mitra: string | null;
  pj_laporan: string | null;
  karyawan: string[];
  modal_awal: number;
  persediaan_awal: number;
  pembelian: number;
  tagihan_titipan: number;
  persediaan_akhir: number;
  pendapatan: { nama: string; jumlah: number }[];
  diskon: number;
  persen_sedekah: number;
  sedekah: number;
  beban: { nama: string; jumlah: number }[];
  bagi_hasil: { nama: string; persen: number; jumlah: number }[];
  transfer: { keterangan: string; jumlah: number; bank: string | null; no_rekening: string | null; atas_nama: string | null }[];
  tgl_terbit: string | null;
  kota_terbit: string | null;
  penandatangan: string | null;
  jabatan_penandatangan: string | null;
};

const BULAN = ["januari", "februari", "maret", "april", "mei", "juni", "juli", "agustus", "september", "oktober", "november", "desember"];
const bulanDari = (s: string) => {
  const m = norm(s).match(new RegExp(`(${BULAN.join("|")})\\s+(\\d{4})`));
  return m ? `${m[2]}-${String(BULAN.indexOf(m[1]) + 1).padStart(2, "0")}` : null;
};

/** Baca sheet "Laporan Keuangan" format Ruma menjadi data laporan bulanan. */
export function parseLaporan(g: Grid): LaporanImpor {
  const teks = (r: number) => (g[r] ?? []).map(norm).filter(Boolean);
  const label = (r: number) => (g[r] ?? []).find((c) => typeof c === "string" && c.trim() && !/^[:(+\-)]+$/.test(c.trim())) as string | undefined;
  const nilaiKanan = (r: number) => {
    const xs = (g[r] ?? []).map(angka).filter((x): x is number => x !== null);
    return xs.length ? xs[xs.length - 1] : 0;
  };
  const cari = (re: RegExp, dari = 0) => {
    for (let r = dari; r < g.length; r++) if (teks(r).some((t) => re.test(t))) return r;
    return -1;
  };
  const isian = (re: RegExp) => {
    const r = cari(re);
    if (r < 0) return null;
    const row = g[r];
    const i = row.findIndex((c) => norm(c) === ":");
    const v = i >= 0 ? row.slice(i + 1).find((c) => c !== null && c !== undefined && String(c).trim()) : null;
    return v === null || v === undefined ? null : v;
  };
  const s = (v: Sel) => (v === null || v === undefined ? null : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).trim() || null);

  const periodeTeks = s(isian(/^periode laporan/));
  const rKar = cari(/^jumlah karyawan/);
  const karyawan: string[] = [];
  if (rKar >= 0) {
    for (let r = rKar + 1; r < Math.min(rKar + 40, g.length); r++) {
      const t = (g[r] ?? []).find((c) => typeof c === "string" && /^\s*\d+\s*\./.test(c)) as string | undefined;
      if (!t) {
        if (teks(r).length) break;
        continue;
      }
      karyawan.push(t.replace(/^\s*\d+\s*\.\s*/, "").trim());
    }
  }
  const rModal = cari(/^saldo awal$/);
  const nilaiLabel = (re: RegExp, dari = 0) => {
    const r = cari(re, dari);
    return r < 0 ? 0 : nilaiKanan(r);
  };

  const rPend = cari(/^pendapatan$/);
  const rTotJual = cari(/^total penjualan/, Math.max(rPend, 0));
  const pendapatan: { nama: string; jumlah: number }[] = [];
  let diskon = 0;
  for (let r = rPend + 1; rPend >= 0 && r < rTotJual; r++) {
    const l = label(r);
    if (!l) continue;
    const v = nilaiKanan(r);
    if (/^disc|^diskon/i.test(l.trim())) diskon = Math.abs(v);
    else pendapatan.push({ nama: l.trim(), jumlah: Math.round(v) });
  }
  const rBeban = cari(/^beban operasional/);
  const rTotBeban = cari(/^total beban operasional/, Math.max(rBeban, 0));
  const beban: { nama: string; jumlah: number }[] = [];
  let sedekah = 0;
  let persenSedekah = 2.5;
  for (let r = rBeban + 1; rBeban >= 0 && r < rTotBeban; r++) {
    const l = label(r);
    if (!l) continue;
    const v = nilaiKanan(r);
    const m = l.match(/sedekah\s*([\d.,]+)?\s*%?/i);
    if (m) {
      sedekah = Math.round(v);
      if (m[1]) persenSedekah = Number(m[1].replace(",", "."));
    } else beban.push({ nama: l.trim().replace(/\s+$/, ""), jumlah: Math.round(v) });
  }
  const rShare = cari(/sharing profit/);
  const rAkhir = cari(/^modal akhir/, Math.max(rShare, 0));
  const bagi_hasil: { nama: string; persen: number; jumlah: number }[] = [];
  for (let r = rShare + 1; rShare >= 0 && r < (rAkhir < 0 ? g.length : rAkhir); r++) {
    const l = label(r);
    const m = l?.match(/^(?:untuk|pembagian hasil(?: a\.?n\.?)?)\s+(.*?)\s*([\d.,]+)\s*%/i);
    if (m) bagi_hasil.push({ nama: m[1].trim().replace(/^a\.?n\.?\s+/i, ""), persen: Number(m[2].replace(",", ".")), jumlah: Math.round(nilaiKanan(r)) });
  }
  const rTf = cari(/penerimaan transfer/);
  const transfer: LaporanImpor["transfer"] = [];
  if (rTf >= 0) {
    const hdr = g[rTf + 1] ?? [];
    const iJ = hdr.findIndex((c) => norm(c) === "jumlah");
    const iBank = iJ + 1;
    const bankDefault = s(hdr[iBank]);
    const sub = g[rTf + 2] ?? [];
    const iRek = sub.findIndex((c) => /rekening/.test(norm(c)));
    const iAn = sub.findIndex((c) => /atas nama/.test(norm(c)));
    for (let r = rTf + 2; r < Math.min(rTf + 40, g.length); r++) {
      const row = g[r] ?? [];
      if (/^total/.test(norm(row[0]))) break;
      if (angka(row[0]) === null) continue;
      const ket = (row.slice(1, iJ).find((c) => typeof c === "string" && c.trim()) as string | undefined)?.trim();
      if (!ket) continue;
      const rek = iRek >= 0 ? s(row[iRek]) : null;
      let an = iAn >= 0 ? s(row[iAn]) : null;
      let bank = rek ? bankDefault : null;
      const b = an?.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
      if (b) {
        an = b[1].trim();
        bank = b[2].trim();
      }
      transfer.push({ keterangan: ket, jumlah: Math.round(angka(row[iJ]) ?? 0), bank, no_rekening: rek, atas_nama: an });
    }
  }
  // "Purbalingga, 10 Oktober 2026" lalu nama & jabatan penandatangan di bawahnya
  let tgl_terbit: string | null = null, kota: string | null = null, ttd: string | null = null, jabatan: string | null = null;
  for (let r = g.length - 1; r >= 0; r--) {
    const t = (g[r] ?? []).find((c) => typeof c === "string" && /^[a-z .]+,\s*\d{1,2}\s+[a-z]+\s+\d{4}$/i.test(c.trim())) as string | undefined;
    if (!t) continue;
    const m = t.trim().match(/^(.*?),\s*(\d{1,2})\s+([a-z]+)\s+(\d{4})$/i)!;
    kota = m[1].trim();
    const bi = BULAN.indexOf(m[3].toLowerCase());
    if (bi >= 0) tgl_terbit = `${m[4]}-${String(bi + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
    const bawah = g.slice(r + 1).map((row) => (row ?? []).find((c) => typeof c === "string" && c.trim()) as string | undefined).filter(Boolean) as string[];
    ttd = bawah[0]?.trim() ?? null;
    jabatan = bawah[1]?.trim() ?? null;
    break;
  }
  const rTitip = cari(/tagihan (titipan|dessert)/);
  return {
    periode: periodeTeks ? bulanDari(periodeTeks) : null,
    nama_outlet: s(isian(/^nama outlet/)),
    mitra: s(isian(/^mitra$/)),
    pj_laporan: s(isian(/^penanggung jawab/)),
    karyawan,
    modal_awal: rModal >= 0 ? Math.round(nilaiKanan(rModal)) : 0,
    persediaan_awal: Math.round(nilaiLabel(/^persedi?a+n awal/)),
    pembelian: Math.round(nilaiLabel(/^pembelian bahan baku/)),
    tagihan_titipan: rTitip >= 0 ? Math.round(nilaiKanan(rTitip)) : 0,
    persediaan_akhir: Math.round(nilaiLabel(/^persedi?a+n akhir/)),
    pendapatan,
    diskon: Math.round(diskon),
    persen_sedekah: persenSedekah,
    sedekah,
    beban,
    bagi_hasil,
    transfer,
    tgl_terbit,
    kota_terbit: kota,
    penandatangan: ttd,
    jabatan_penandatangan: jabatan,
  };
}

/** Grid sel dari worksheet exceljs (nilai rumus memakai hasilnya). */
export function gridDariSheet(ws: { rowCount: number; columnCount: number; getRow: (r: number) => { getCell: (c: number) => { value: unknown } } }): Grid {
  const g: Grid = [];
  // sheet berformat sering melebar ribuan kolom/baris kosong: format Ruma cukup 64 kolom
  const kolom = Math.min(ws.columnCount, 64);
  const baris = Math.min(ws.rowCount, 20000);
  for (let r = 1; r <= baris; r++) {
    const row = ws.getRow(r);
    const out: Sel[] = [];
    for (let c = 1; c <= kolom; c++) {
      let v = row.getCell(c).value as unknown;
      if (v && typeof v === "object" && !(v instanceof Date)) {
        const o = v as { result?: unknown; richText?: { text: string }[]; text?: string };
        v = o.result !== undefined ? o.result : o.richText ? o.richText.map((x) => x.text).join("") : (o.text ?? null);
      }
      out.push(v as Sel);
    }
    g.push(out);
  }
  return g;
}
