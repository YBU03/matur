"use server";
import { supabaseServer } from "./supabase/server";
import { bacaSoDraft, type SoDraft } from "./so-draft";
export async function cadangkanSo(draft: SoDraft): Promise<{ error?: string }> {
  if (!bacaSoDraft(draft, draft.outletId)) return { error: "Draft tidak valid." };
  const db = await supabaseServer();
  const { error } = await db.rpc("cadangkan_draft_so", { p: draft });
  return error ? { error: "Cadangan server belum tersimpan. Draft perangkat tetap ada." } : {};
}
export async function daftarDraftSo(outletId: string): Promise<{ drafts?: SoDraft[]; error?: string }> {
  const db = await supabaseServer();
  const { data, error } = await db.from("draft_opname_outlet").select("data").eq("outlet_id", outletId).order("updated_at", { ascending: false }).limit(60);
  if (error) return { error: "Cadangan server belum dapat dimuat." };
  return { drafts: (data ?? []).map(r => bacaSoDraft(r.data, outletId)).filter((d): d is SoDraft => !!d) };
}
