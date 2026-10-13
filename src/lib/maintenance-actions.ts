"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "./supabase/server";

export async function aturMaintenance(aktif: boolean, pesan: string) {
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("atur_maintenance", { p_aktif: aktif, p_pesan: pesan });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return {};
}
