// Catatan harian: gabungkan angka POS per tanggal dengan input manual (angka dashboard platform & koreksi).
// Nilai kanal = (angka platform bila diisi, selain itu angka POS) + Σ koreksi. Murni & diuji.

export const KANAL_HARIAN = ["tunai", "non_tunai", "gofood", "grabfood", "tiktok", "ruma_app", "shopeefood", "tumbler"] as const;
export type KanalHarian = (typeof KANAL_HARIAN)[number] | "diskon";
export const LABEL_KANAL: Record<KanalHarian, string> = {
  tunai: "Tunai",
  non_tunai: "Non Tunai",
  gofood: "Go Food",
  grabfood: "Grab Food",
  tiktok: "Tiktok Go",
  ruma_app: "Ruma App",
  shopeefood: "Shopee Food",
  tumbler: "Tumbler",
  diskon: "Discount",
};
export const OJOL: KanalHarian[] = ["gofood", "grabfood", "shopeefood", "tiktok"];

export type Manual = { id: string; tanggal: string; kanal: KanalHarian; jenis: "platform" | "koreksi"; jumlah: number; keterangan: string | null; nama_pembuat: string | null; created_at: string };
export type PosHari = { tanggal: string } & Partial<Record<KanalHarian, number>>;
export type NilaiKanal = { pos: number; platform: number | null; koreksi: number; akhir: number };

export function nilaiHari(pos: PosHari, manual: Manual[]): Record<KanalHarian, NilaiKanal> {
  const out = {} as Record<KanalHarian, NilaiKanal>;
  for (const k of [...KANAL_HARIAN, "diskon"] as KanalHarian[]) {
    const m = manual.filter((x) => x.tanggal === pos.tanggal && x.kanal === k);
    const plat = m.filter((x) => x.jenis === "platform");
    // angka platform terbaru yang dipakai (bila diinput lebih dari sekali)
    const platform = plat.length ? Number([...plat].sort((a, b) => b.created_at.localeCompare(a.created_at))[0].jumlah) : null;
    const koreksi = m.filter((x) => x.jenis === "koreksi").reduce((s, x) => s + Number(x.jumlah), 0);
    const p = Number(pos[k] ?? 0);
    out[k] = { pos: p, platform, koreksi, akhir: (platform ?? p) + koreksi };
  }
  return out;
}

/** Total sebulan per kanal setelah koreksi (dipakai proyeksi laporan & ekspor). */
export function totalBulan(hari: PosHari[], manual: Manual[]) {
  const tanggal = [...new Set([...hari.map((h) => h.tanggal), ...manual.map((m) => m.tanggal)])];
  const tot = Object.fromEntries([...KANAL_HARIAN, "diskon"].map((k) => [k, 0])) as Record<KanalHarian, number>;
  for (const t of tanggal) {
    const v = nilaiHari(hari.find((h) => h.tanggal === t) ?? { tanggal: t }, manual);
    for (const k of Object.keys(tot) as KanalHarian[]) tot[k] += v[k].akhir;
  }
  return tot;
}

// ── Rincian uang Catatan Harian (sama dengan rekap_harian di database) ──
/** Mulai hari operasional ini kolom uang = METODE BAYAR (sama dengan Penjualan POS, setoran & mutasi bank).
 *  Kanal = asal pesanan; tumbler = wadah (uangnya ikut tunai/QRIS). Sebelum tanggal ini tetap per kanal. */
export const RINCIAN_METODE_MULAI = "2026-11-05";
export const METODE_PLATFORM_HARIAN = ["gofood", "grabfood", "shopeefood", "tiktok", "ruma_app"];
/** Kolom Catatan Harian untuk satu pembayaran. */
export const kolomBayar = (kanal: string, metode: string, tanggal = RINCIAN_METODE_MULAI) =>
  tanggal >= RINCIAN_METODE_MULAI
    ? METODE_PLATFORM_HARIAN.includes(metode) ? metode : metode === "tunai" ? "tunai" : "non_tunai"
    : kanal !== "langsung" ? kanal : metode === "tunai" ? "tunai" : "non_tunai";
/** Kanal & metode tidak cocok (info untuk akunting; sejak 5 Nov tidak mengubah angka). */
export const janggal = (kanal: string, metode: string) =>
  (kanal === "langsung" && METODE_PLATFORM_HARIAN.includes(metode)) || (METODE_PLATFORM_HARIAN.includes(kanal) && metode !== kanal);
/** Rekap rincian per kolom dari daftar pembayaran (dipakai untuk uji: harus = rekap per metode Penjualan POS). */
export function rincianDariPembayaran(trx: { kanal: string; tanggal: string; bayar: { metode: string; nominal: number }[] }[]) {
  const out: Record<string, number> = {};
  for (const t of trx) for (const b of t.bayar) {
    const k = kolomBayar(t.kanal, b.metode, t.tanggal);
    out[k] = (out[k] ?? 0) + b.nominal;
  }
  return out;
}
