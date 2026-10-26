"use server";
import { revalidatePath } from "next/cache";
import { getSession } from "./session";
import { supabaseServer } from "./supabase/server";
export async function aturTestingPos(
  outlet: string,
  aktif: boolean,
  versi: string | null,
) {
  const db = await supabaseServer();
  const { error } = await db.rpc("atur_testing_pos", {
    p_outlet: outlet,
    p_aktif: aktif,
    p_versi: versi,
  });
  if (error) return { error: error.message };
  revalidatePath("/pengaturan/pos");
  revalidatePath("/pos");
  revalidatePath("/pos/testing");
  return { ok: "Mode testing diperbarui." };
}
export async function cekTestingPos() {
  const s = await getSession();
  if (s?.active?.role !== "tablet" || !s.active.outletId) return false;
  const db = await supabaseServer();
  const { data, error } = await db.rpc("status_testing_pos", {
    p_outlet: s.active.outletId,
  });
  if (error) throw new Error("Status testing belum dapat diperiksa.");
  return data === true;
}
