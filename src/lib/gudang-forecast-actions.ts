"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "./session";
import { supabaseServer } from "./supabase/server";

/** Simpan buffer Smart Forecast (persen) — Owner/Admin Pusat/Admin Gudang. */
export async function simpanBuffer(persen: number): Promise<{ ok?: string; error?: string }> {
  const s = await getSession();
  if (!s?.active || !["owner", "admin_pusat", "admin_gudang"].includes(s.active.role)) return { error: "Tidak berwenang mengubah buffer." };
  if (!Number.isFinite(persen) || persen < 0 || persen > 200) return { error: "Buffer 0–200%." };
  const db = await supabaseServer();
  const { error } = await db.rpc("atur_buffer_forecast", { p_persen: Math.round(persen * 100) / 100 });
  if (error) return { error: error.message };
  revalidatePath("/gudang/pergerakan");
  return { ok: `Buffer ${persen}% tersimpan.` };
}
