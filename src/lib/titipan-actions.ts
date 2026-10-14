"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "./supabase/server";

/** Catat setoran barang titipan dari produsen (qty negatif = retur/koreksi). */
export async function catatTitipan(outletId: string, menuId: string, qty: number, tanggal: string, catatan: string): Promise<{ error?: string; ok?: string }> {
  const q = Math.round(Number(qty));
  if (!q) return { error: "Jumlah tidak boleh 0." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) return { error: "Tanggal tidak valid." };
  const supabase = await supabaseServer();
  const { error } = await supabase.from("titipan_masuk").insert({ outlet_id: outletId, menu_id: menuId, qty: q, tanggal, catatan: catatan.trim().slice(0, 200) || null });
  if (error) return { error: error.message.includes("row-level") ? "Anda tidak punya akses mencatat titipan di outlet ini." : error.message };
  revalidatePath("/titipan");
  revalidatePath("/persediaan");
  return { ok: q > 0 ? `Setoran ${q} pcs dicatat.` : `Retur/koreksi ${-q} pcs dicatat.` };
}
