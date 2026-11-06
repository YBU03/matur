import { KANAL_HARIAN, LABEL_KANAL, type KanalHarian, type NilaiKanal } from "./harian";

export type KategoriHarian = { id: string; nama: string; urutan: number };
export type KolomHarian =
  | { jenis: "keterangan"; key: "keterangan"; label: string }
  | { jenis: "jual"; key: KanalHarian; label: string }
  | { jenis: "total_jual"; key: "total_jual"; label: string }
  | { jenis: "biaya"; key: string; label: string }
  | { jenis: "total_biaya"; key: "total_biaya"; label: string }
  | { jenis: "kas"; key: "seharusnya" | "setoran" | "selisih"; label: string }
  /** info saja (tidak dijumlah ke total): mis. pelanggan bawa tumbler — uangnya sudah masuk tunai/QRIS */
  | { jenis: "info"; key: "tumbler_info"; label: string };

// Display aliases only: the category ID remains the source of values and edits.
export const PENGELUARAN_RUMA: [string, RegExp][] = [
  ["Es Kristal", /^(es kristal|es batu)$/i],
  ["Bahan Baku", /^(biaya )?bahan baku$/i],
  ["Biaya Galon", /^(biaya )?galon$/i],
  ["Sewa Outlet", /^(biaya sewa|sewa outlet|sewa)$/i],
  ["Listrik", /^(biaya )?listrik$/i],
  ["Internet", /^(biaya )?(internet(\/wifi)?|wifi)$/i],
  ["Air", /^(biaya )?(air(\/pdam)?|pdam)$/i],
  ["Maintenance", /^(biaya )?maintenance$/i],
  ["B. Gaji", /^(biaya |b\. )?gaji$/i],
  ["Biaya Perlengkapan", /^(biaya )?perlengkapan$/i],
  ["Biaya Pemeliharaan Lingkungan", /^(biaya )?pemeliharaan lingkungan$/i],
  ["Lain Lain", /^(biaya )?lain[ -]lain$/i],
  ["Reimburse", /^reimburse$/i],
  ["Sedekah", /^sedekah$/i],
  ["Distribusi", /^(biaya )?distribusi$/i],
  ["Marketing", /^(biaya )?marketing$/i],
];

export function kolomHarianRuma(kategori: KategoriHarian[], perKategori = true): (KolomHarian & { ada: boolean })[] {
  const dipakai = new Set<string>();
  const biaya = PENGELUARAN_RUMA.flatMap(([label, pola]) => {
    const k = kategori.find(k => !dipakai.has(k.id) && pola.test(k.nama.trim()));
    if (!k) return [];
    dipakai.add(k.id);
    return [{ jenis: "biaya" as const, key: k.id, label, ada: perKategori }];
  });
  return [
    { jenis: "keterangan", key: "keterangan", label: "Keterangan", ada: true },
    ...(["tunai", "non_tunai", "gofood", "grabfood", "tiktok", "ruma_app", "shopeefood", "diskon"] as KanalHarian[]).map(key => ({ jenis: "jual" as const, key, label: key === "gofood" ? "Go food" : key === "grabfood" ? "Grabfood" : LABEL_KANAL[key], ada: true })),
    ...biaya,
    { jenis: "total_jual", key: "total_jual", label: "Total Penjualan", ada: true },
    { jenis: "total_biaya", key: "total_biaya", label: "Total Pengeluaran", ada: true },
    { jenis: "kas", key: "seharusnya", label: "Kas Seharusnya", ada: true },
    { jenis: "kas", key: "setoran", label: "Setoran Aktual", ada: true },
    { jenis: "kas", key: "selisih", label: "Selisih Kas", ada: true },
    { jenis: "info", key: "tumbler_info", label: "🥤 Tumbler (info)", ada: true },
    { jenis: "jual", key: "tumbler", label: "Tumbler", ada: false },
    ...kategori.filter(k => !dipakai.has(k.id)).sort((a,b) => a.urutan-b.urutan).map(k => ({ jenis: "biaya" as const, key: k.id, label: k.nama, ada: false })),
  ];
}

/** Gross channel values minus discount once, including hidden channels. */
export function totalPenjualanHarian(nilai: Record<KanalHarian, NilaiKanal>) {
  return KANAL_HARIAN.reduce((sum,k) => sum + nilai[k].akhir,0) - nilai.diskon.akhir;
}

export function keteranganHarian(shift: number, biaya: { keterangan: string | null; kategori_id: string }[], kategori: KategoriHarian[]) {
  const nama = new Map(kategori.map(k => [k.id,k.nama]));
  return [shift ? `${shift} shift` : "", ...biaya.map(b => b.keterangan?.trim() || nama.get(b.kategori_id) || "Pengeluaran")].filter(Boolean).join(" · ");
}
