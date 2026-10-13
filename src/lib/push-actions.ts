"use server";

import { supabaseServer } from "./supabase/server";

export async function simpanLanggananPush(sub: { endpoint: string; keys: { p256dh: string; auth: string } }): Promise<{ error?: string }> {
  if (!/^https:\/\//.test(sub.endpoint)) return { error: "Langganan tidak valid." };
  const supabase = await supabaseServer();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { error: "Sesi berakhir." };
  const { error } = await supabase.from("push_langganan").upsert({ pengguna_id: u.user.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth }, { onConflict: "endpoint" });
  return error ? { error: error.message } : {};
}
