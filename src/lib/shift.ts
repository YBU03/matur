// Shift (sesi kas) yang aktif di perangkat POS ini.
// Perangkat outlet tetap login dengan satu akun; staf memulai shift dengan PIN → id sesinya disimpan di cookie perangkat.
// Tanpa cookie: shift milik akun yang sedang login (cara lama, HP/akun sendiri).
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

export const COOKIE_SESI = "pos_sesi";
export type SesiAktif = { id: string; modal_laci: number; dibuka_at: string; kasir_id: string; nama_kasir: string | null };

export async function idSesiPerangkat() {
  return (await cookies()).get(COOKIE_SESI)?.value ?? null;
}

export async function sesiAktif(supabase: SupabaseClient, outletId: string, userId: string): Promise<SesiAktif | null> {
  const kol = "id, modal_laci, dibuka_at, kasir_id, nama_kasir";
  const id = await idSesiPerangkat();
  if (id && /^[0-9a-f-]{36}$/.test(id)) {
    const { data } = await supabase.from("sesi_kas").select(kol).eq("id", id).eq("outlet_id", outletId).is("ditutup_at", null).maybeSingle();
    if (data) return data as SesiAktif;
  }
  const { data } = await supabase.from("sesi_kas").select(kol).eq("mode", "asli").eq("outlet_id", outletId).eq("kasir_id", userId).is("ditutup_at", null).maybeSingle();
  return (data as SesiAktif | null) ?? null;
}
