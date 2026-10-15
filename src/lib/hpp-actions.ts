"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "./session";
import { supabaseServer } from "./supabase/server";

// Hubungkan HPP dari file ke menu POS (mis. "Jasmine Tea" → "Teh Java")
export async function hubungkanHpp(id: string, menuId: string | null): Promise<{ error?: string }> {
  const s = await getSession();
  if (!s?.active || !["owner", "admin_pusat", "admin_gudang"].includes(s.active.role)) return { error: "Tidak diizinkan." };
  const supabase = await supabaseServer();
  const { error } = await supabase.from("hpp_menu").update({ menu_id: menuId }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/hpp-menu");
  return {};
}

export async function tambahHpp(d: { menu_id: string; nama: string; kategori_id: string; harga: number; harga_ojol: number; seri: string; bahan: { id: string; qty: number }[] }): Promise<{ error?: string; ok?: string }> {
  const s = await getSession();
  if (!s?.active || !["owner", "admin_pusat", "admin_gudang"].includes(s.active.role)) return { error: "Tidak diizinkan." };
  const db = await supabaseServer();
  const { error } = await db.rpc("tambah_hpp", { p: d });
  if (error) return { error: error.message };
  for (const p of ["/hpp-menu", "/master/menu", "/master/resep", "/kasir/pos"]) revalidatePath(p);
  return { ok: "HPP, menu POS dan resep bahan sudah terhubung." };
}
