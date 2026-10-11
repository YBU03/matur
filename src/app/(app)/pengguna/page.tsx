import { notFound } from "next/navigation";
import { findMenu } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { UserAdmin, type UserRow } from "./user-admin";

export default async function PenggunaPage() {
  const s = await getSession();
  if (!s?.active || !findMenu(s.active.role, "/pengguna")) notFound();
  const supabase = await supabaseServer();
  const [{ data: users }, { data: tugas }, { data: outlets }] = await Promise.all([
    supabase.from("pengguna").select("id, nama, email, no_hp, status, permintaan, created_at").order("nama"),
    supabase.from("penugasan").select("id, pengguna_id, peran, outlet_id"),
    supabase.from("outlet").select("id, nama").eq("mode", "asli").is("deleted_at", null).order("nama"),
  ]);
  const rows: UserRow[] = (users ?? []).map((u) => ({
    ...u,
    assignments: (tugas ?? []).filter((t) => t.pengguna_id === u.id),
  }));
  return <UserAdmin users={rows} outlets={outlets ?? []} isOwner={s.active.role === "owner"} meId={s.userId} />;
}
