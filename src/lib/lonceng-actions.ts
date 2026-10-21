"use server";

import { getSession } from "./session";
import { supabaseServer } from "./supabase/server";

/** tandai semua notifikasi milik pengguna aktif sebagai sudah dibaca (saat lonceng dibuka) */
export async function tandaiNotifDibaca(): Promise<void> {
  const s = await getSession();
  if (!s) return;
  const supabase = await supabaseServer();
  await supabase.from("notifikasi").update({ dibaca_at: new Date().toISOString() }).eq("pengguna_id", s.userId).is("dibaca_at", null);
}
