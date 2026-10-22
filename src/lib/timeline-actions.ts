"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "./session";
import { supabaseServer } from "./supabase/server";

export async function simpanUrutanTimeline(proyekId: string, ids: string[], dasar: Record<string, number>): Promise<{ error?: string }> {
  const s = await getSession();
  if (s?.status !== "aktif" || !s.active || !["owner", "admin_pusat"].includes(s.active.role)) return { error: "Hanya Owner/Admin Pusat yang dapat mengatur urutan." };
  if (!Array.isArray(ids) || !ids.length || ids.length > 2000 || new Set(ids).size !== ids.length || !dasar || typeof dasar !== "object") return { error: "Susunan kegiatan tidak valid." };
  const db = await supabaseServer();
  const { error } = await db.rpc("simpan_urutan_timeline", { p_proyek: proyekId, p_ids: ids, p_dasar: dasar });
  if (error) return { error: error.message };
  revalidatePath(`/proyek/${proyekId}`);
  return {};
}
