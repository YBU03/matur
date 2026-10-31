"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "./session";
import { supabaseServer } from "./supabase/server";
import { PENGELOLA_MENU, type VarianMenuInput } from "./menu-varian";

/** Simpan kemasan (anak menu) + pilihan Gula/Extra satu menu sekaligus. */
export async function simpanVarianMenu(p: VarianMenuInput): Promise<{ ok?: string; error?: string }> {
  const s = await getSession();
  if (!s?.active || !PENGELOLA_MENU.includes(s.active.role)) return { error: "Tidak berwenang mengatur varian menu." };
  const db = await supabaseServer();
  const { error } = await db.rpc("atur_varian_menu", { p });
  if (error) return { error: error.message };
  for (const path of ["/master/menu", "/master/varian", "/kasir/pos", "/hpp-menu", `/menu-varian/${p.menu_id}`]) revalidatePath(path);
  return { ok: "Varian & kemasan tersimpan. POS memakai harga baru setelah halaman kasir dimuat ulang." };
}

/** Ganti resep dasar satu menu/kemasan (dipakai POS untuk potong stok & HPP). */
export async function simpanResep(menuId: string, bahan: { bahan_id: string; takaran: number }[]): Promise<{ ok?: string; error?: string }> {
  const s = await getSession();
  if (!s?.active || !PENGELOLA_MENU.includes(s.active.role)) return { error: "Tidak berwenang mengatur resep." };
  const db = await supabaseServer();
  const { error } = await db.rpc("atur_resep_menu", { p: { menu_id: menuId, bahan: bahan.map((b) => ({ bahan_id: b.bahan_id, takaran: String(Math.round(b.takaran * 1000) / 1000) })) } });
  if (error) return { error: error.message };
  for (const path of ["/hpp-menu", "/master/resep", "/kasir/pos"]) revalidatePath(path);
  revalidatePath("/menu-varian/[id]", "page");
  return { ok: "Resep tersimpan. Penjualan berikutnya memakai resep ini untuk potong stok & HPP." };
}
