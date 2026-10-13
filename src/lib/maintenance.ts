import type { Role } from "./roles";
import { supabaseServer } from "./supabase/server";

/** Peran yang tetap bisa masuk saat maintenance (untuk mengecek & mematikannya lagi). */
export const KEBAL_MAINTENANCE: Role[] = ["owner", "admin_pusat"];

export async function statusMaintenance(): Promise<{ aktif: boolean; pesan: string | null }> {
  const supabase = await supabaseServer();
  const { data } = await supabase.rpc("status_maintenance");
  return (data as { aktif: boolean; pesan: string | null } | null) ?? { aktif: false, pesan: null };
}
