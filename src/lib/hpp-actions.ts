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
