import type { Role } from "./roles";

// Varian menu: Kemasan = anak menu (harga sendiri), Gula/Extra/dll = varian yang disinkronkan ke semua kemasan.
export const PENGELOLA_MENU: Role[] = ["owner", "admin_pusat", "admin_gudang"];
export const GRUP_OPSI = ["Gula", "Extra", "Suhu", "Ukuran"] as const;
export type GrupOpsi = (typeof GRUP_OPSI)[number];
export const MULTI_OPSI = new Set<string>(["Extra"]);
export const SARAN: Record<"Kemasan" | GrupOpsi, string[]> = {
  Kemasan: ["Cup", "Hot", "Can", "Botol"],
  Gula: ["Normal Sugar", "Less Sugar", "No Sugar"],
  Extra: ["Extra Shot", "Extra Susu", "Boba"],
  Suhu: ["Ice", "Hot"],
  Ukuran: ["Regular", "Large"],
};

export type KemasanInput = { id?: string; nama: string; harga_langsung: number; harga_ojol: number; aktif: boolean };
export type OpsiInput = { grup: GrupOpsi; nama: string; tambahan_harga: number };
export type VarianMenuInput = { menu_id: string; kemasan: KemasanInput[]; opsi: OpsiInput[] };

/** Validasi ringan di klien (server tetap memeriksa ulang). */
export function cekVarian(p: VarianMenuInput): string | null {
  const ok = (n: number) => Number.isSafeInteger(n) && n >= 0 && n <= 999_999_999;
  const nama = (x: string) => x.trim().length >= 1 && x.trim().length <= 40;
  if (p.kemasan.some((k) => !nama(k.nama))) return "Nama kemasan wajib diisi (maks. 40 karakter).";
  if (p.kemasan.some((k) => !ok(k.harga_langsung) || !ok(k.harga_ojol))) return "Harga kemasan harus rupiah 0 atau lebih.";
  if (new Set(p.kemasan.map((k) => k.nama.trim().toLowerCase())).size !== p.kemasan.length) return "Nama kemasan tidak boleh sama.";
  if (p.opsi.some((o) => !nama(o.nama))) return "Nama pilihan wajib diisi (maks. 40 karakter).";
  if (p.opsi.some((o) => !ok(o.tambahan_harga))) return "Harga tambahan harus rupiah 0 atau lebih.";
  if (new Set(p.opsi.map((o) => o.grup + ":" + o.nama.trim().toLowerCase())).size !== p.opsi.length) return "Pilihan dalam satu grup tidak boleh sama.";
  return null;
}
