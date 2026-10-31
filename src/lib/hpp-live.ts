// HPP live = resep dasar (varian kosong) × HPP per satuan pakai bahan; titipan = harga titip. Sama dengan perhitungan POS.
export type BahanHpp = { id: string; nama: string; satuan_pakai: string; harga_pokok: number | null };
export type BarisResep = { menu_id: string; varian_id: string | null; bahan_id: string; takaran: number };

export function hppResep(baris: { bahan_id: string; takaran: number }[], bahan: Map<string, BahanHpp>) {
  return Math.round(baris.reduce((n, r) => n + Number(r.takaran) * Number(bahan.get(r.bahan_id)?.harga_pokok ?? 0), 0));
}

export const marginPersen = (jual: number, hpp: number) => (jual > 0 ? Math.round(((jual - hpp) / jual) * 100) : 0);
export const nadaMargin = (m: number) => (m >= 60 ? "hijau" : m >= 45 ? "kuning" : "merah") as "hijau" | "kuning" | "merah";
