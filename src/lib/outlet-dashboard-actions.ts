"use server";
import { revalidatePath } from "next/cache";
import { getSession } from "./session";
import { supabaseServer } from "./supabase/server";

export async function aturTampilDashboardPos(
  id: string,
  sebelum: boolean,
  tampil: boolean,
): Promise<{ error?: string; value?: boolean }> {
  const s = await getSession();
  if (!s?.active || !["owner", "admin_pusat"].includes(s.active.role))
    return {
      error:
        "Hanya Owner/Admin Pusat yang dapat mengatur tampilan Dashboard POS.",
    };
  const db = await supabaseServer();
  const { data, error } = await db.rpc("atur_tampil_dashboard_pos", {
    p_outlet: id,
    p_sebelum: sebelum,
    p_tampil: tampil,
  });
  if (error) return { error: error.message };
  for (const path of [
    "/master/outlet",
    "/dashboard",
    "/dashboard-pos",
    "/pantau-pos",
    "/laporan-pos",
  ])
    revalidatePath(path);
  return { value: data as boolean };
}
