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
