import "server-only";
import { notFound } from "next/navigation";
import { isAdminDashboardRole } from "./dashboard-navigation";
import { getSession } from "./session";
import { supabaseServer } from "./supabase/server";

/** Check the active role before making any POS data request. Existing RPC/RLS stays authoritative. */
export async function loadDashboardPos(sp: Record<string, string | undefined>) {
  const s = await getSession();
  if (!s?.active || !isAdminDashboardRole(s.active.role)) notFound();
  const db = await supabaseServer();
  const { data, error } = await db
    .from("outlet")
    .select("id, nama, jam_operasional")
    .eq("mode", "asli")
    .is("deleted_at", null)
    .order("nama");
  const outlets = data ?? [];
  const outletId = outlets.some((o) => o.id === sp.outlet) ? sp.outlet! : null;
  const mode: "asli" | "simulasi" =
    sp.mode === "simulasi" ? "simulasi" : "asli";
  return { outlets, outletId, mode, error, sp };
}
