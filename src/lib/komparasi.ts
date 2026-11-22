// Perhitungan murni untuk tab Komparasi di Dashboard POS (antar outlet atau antar periode).
// Sumber data sama dengan dashboard: RPC ringkasan_penjualan (hanya baca).
import type { Ringkasan } from "@/app/(app)/dashboard/sales";

export type Sisi = {
  omzet: number;
  trx: number;
  rataStruk: number;
  item: number;
  diskon: number;
  hpp: number;
  labaKotor: number;
};

export function metrik(d: Ringkasan | null): Sisi {
  const k = d?.kpi ?? { omzet: 0, trx: 0, hpp: 0, diskon: 0 };
  const item = (d?.menu ?? []).reduce((s, m) => s + Number(m.qty), 0);
  const omzet = Number(k.omzet) || 0, trx = Number(k.trx) || 0, hpp = Number(k.hpp) || 0;
  return { omzet, trx, rataStruk: trx ? Math.round(omzet / trx) : 0, item, diskon: Number(k.diskon) || 0, hpp, labaKotor: omzet - hpp };
}

/** Selisih % B terhadap A (positif = A lebih besar). null bila keduanya 0. */
export function selisihPersen(a: number, b: number) {
  if (!a && !b) return null;
  if (!b) return 100;
  return Math.round(((a - b) / Math.abs(b)) * 100);
}

/** Porsi A dari total A+B dalam persen (untuk bar tarik tambang). */
export const porsi = (a: number, b: number) => (a + b > 0 ? Math.round((a / (a + b)) * 100) : 50);

/** Transaksi per jam (0–23) dari data jam (dow × jam). */
export function perJam(jam: Ringkasan["jam"] | undefined) {
  const out = Array.from({ length: 24 }, () => 0);
  for (const j of jam ?? []) out[Number(j.jam)] += Number(j.trx) || 0;
  return out;
}

/** Urutan jam operasional 06.00 → 02.00 (lewat tengah malam). */
export const URUT_JAM = [...Array.from({ length: 18 }, (_, i) => i + 6), 0, 1, 2];

/** Jam tersibuk & tersepi (hanya jam yang punya transaksi untuk "sepi"). */
export function ramaiSepi(jam: number[]) {
  const aktif = URUT_JAM.filter((h) => jam[h] > 0);
  if (!aktif.length) return { ramai: null as number | null, sepi: null as number | null };
  const ramai = aktif.reduce((m, h) => (jam[h] > jam[m] ? h : m), aktif[0]);
  const sepi = aktif.reduce((m, h) => (jam[h] < jam[m] ? h : m), aktif[0]);
  return { ramai, sepi };
}
export const labelJam = (h: number | null) => (h === null ? "—" : `${String(h).padStart(2, "0")}.00–${String((h + 1) % 24).padStart(2, "0")}.00`);

/** Gabungkan omzet harian dua sisi. Mode periode: disejajarkan per "Hari ke-n". */
export function trenGabung(
  a: Ringkasan["harian"] | undefined,
  b: Ringkasan["harian"] | undefined,
  rA: { dari: string; hari: number },
  rB: { dari: string; hari: number },
  sejajarHari: boolean,
) {
  const sum = (rows: Ringkasan["harian"] | undefined) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) m.set(r.tgl, (m.get(r.tgl) ?? 0) + Number(r.omzet));
    return m;
  };
  const ma = sum(a), mb = sum(b);
  const tgl = (dari: string, i: number) => new Date(Date.parse(dari + "T00:00:00Z") + i * 86400_000).toISOString().slice(0, 10);
  const BLN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const n = Math.max(rA.hari, sejajarHari ? rB.hari : 0);
  return Array.from({ length: n }, (_, i) => {
    const ta = tgl(rA.dari, i), tb = tgl(rB.dari, i);
    const d = new Date(ta + "T00:00:00Z");
    return { label: sejajarHari ? `Hari ${i + 1}` : `${d.getUTCDate()} ${BLN[d.getUTCMonth()]}`, a: i < rA.hari ? ma.get(ta) ?? 0 : 0, b: sejajarHari ? (i < rB.hari ? mb.get(tb) ?? 0 : 0) : mb.get(ta) ?? 0 };
  });
}

/** Gabungkan daftar bernama (kanal/kategori) jadi baris {name, a, b}, urut total terbesar. */
export function gabungNama<T extends { omzet: number }>(a: T[] | undefined, b: T[] | undefined, nama: (x: T) => string, nilai: (x: T) => number = (x) => Number(x.omzet)) {
  const m = new Map<string, { name: string; a: number; b: number }>();
  for (const x of a ?? []) { const k = nama(x); m.set(k, { name: k, a: (m.get(k)?.a ?? 0) + nilai(x), b: m.get(k)?.b ?? 0 }); }
  for (const x of b ?? []) { const k = nama(x); m.set(k, { name: k, a: m.get(k)?.a ?? 0, b: (m.get(k)?.b ?? 0) + nilai(x) }); }
  return [...m.values()].sort((x, y) => y.a + y.b - (x.a + x.b));
}

/** Kalimat kesimpulan otomatis. */
export function kesimpulan(a: Sisi, b: Sisi, nA: string, nB: string) {
  if (!a.trx && !b.trx) return ["Belum ada transaksi pada kedua sisi untuk periode ini."];
  const out: string[] = [];
  const banding = (label: string, x: number, y: number, satuan: (n: number) => string) => {
    const s = selisihPersen(x, y);
    if (s === null || s === 0) return out.push(`${label} sama kuat (${satuan(x)}).`);
    const [menang, kalah, p] = s > 0 ? [nA, nB, s] : [nB, nA, selisihPersen(y, x) ?? 0];
    out.push(`${menang} unggul ${label.toLowerCase()} ${p >= 999 ? "jauh" : `+${p}%`} dibanding ${kalah}.`);
  };
  const rp = (n: number) => "Rp" + new Intl.NumberFormat("id-ID").format(Math.round(n));
  banding("Omzet", a.omzet, b.omzet, rp);
  banding("Jumlah struk", a.trx, b.trx, (n) => `${n} struk`);
  banding("Rata-rata per struk", a.rataStruk, b.rataStruk, rp);
  return out;
}

/** Menu yang sama-sama masuk 10 teratas (qty) di kedua sisi. */
export function menuSama(a: Ringkasan["menu"] | undefined, b: Ringkasan["menu"] | undefined) {
  const top = (x: Ringkasan["menu"] | undefined) => new Set([...(x ?? [])].sort((p, q) => Number(q.qty) - Number(p.qty)).slice(0, 10).map((m) => m.nama));
  const ta = top(a), tb = top(b);
  return new Set([...ta].filter((n) => tb.has(n)));
}
