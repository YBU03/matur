import { notFound } from "next/navigation";
import { findMenu } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { LiveRefresh } from "@/components/live-refresh";
import { UserAdmin, type UserRow } from "./user-admin";

export default async function PenggunaPage() {
  const s = await getSession();
  if (!s?.active || !findMenu(s.active.role, "/pengguna")) notFound();
  const supabase = await supabaseServer();
  const [{ data: users }, { data: tugas }, { data: outlets }] = await Promise.all([
    supabase.from("pengguna").select("id, nama, email, no_hp, status, permintaan, created_at").neq("status", "dihapus").eq("akun_tablet", false).order("nama"),
    supabase.from("penugasan").select("id, pengguna_id, peran, outlet_id"),
    supabase.from("outlet").select("id, nama").eq("mode", "asli").is("deleted_at", null).order("nama"),
  ]);
  // HRD & Admin Gudang hanya mengelola akun kasir/barista dan pendaftar karyawan outlet
  const staf = s.active.role === "hrd" || s.active.role === "admin_gudang";
  let ids: Set<string> | null = null;
  if (staf) {
    const { data } = await supabase.rpc("id_staf_outlet");
    ids = new Set(((data ?? []) as unknown as string[]).map(String));
  }
  const rows: UserRow[] = (users ?? [])
    .filter((u) => !ids || ids.has(u.id) || (u.status === "menunggu" && (u.permintaan as { jenis?: string } | null)?.jenis === "staf_outlet"))
    .map((u) => ({
      ...u,
      assignments: (tugas ?? []).filter((t) => t.pengguna_id === u.id),
    }));
  return (
    <>
      <LiveRefresh pantau={[{ table: "pengguna" }, { table: "penugasan" }]} />
      <UserAdmin users={rows} outlets={outlets ?? []} isOwner={s.active.role === "owner"} staf={staf} meId={s.userId} />
    </>
  );
}
