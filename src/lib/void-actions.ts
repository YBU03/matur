"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "./session";
import { supabaseServer } from "./supabase/server";

const PENGATUR_VOID = ["owner", "admin_pusat", "hrd", "admin_gudang"];

/** Switch per outlet: void di POS wajib PIN SPV (aktif) atau langsung dengan alasan (mati). */
export async function aturVoidPin(outletId: string, aktif: boolean): Promise<{ error?: string; ok?: string }> {
  const r = (await getSession())?.active?.role;
  if (!r || !PENGATUR_VOID.includes(r)) return { error: "Tidak berwenang." };
  const db = await supabaseServer();
  const { error } = await db.rpc("atur_void_pin", { p_outlet: outletId, p_aktif: aktif });
  if (error) return { error: error.message.replace(/^.*?ERROR:\s*/, "") };
  revalidatePath("/pengaturan/pos");
  revalidatePath("/kasir/riwayat");
  return { ok: aktif ? "Void di outlet ini sekarang wajib PIN SPV." : "Void di outlet ini langsung dari POS (alasan wajib)." };
}
