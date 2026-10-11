import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import type { Role } from "./roles";
import { supabaseServer } from "./supabase/server";

// Sesi = pengguna Supabase Auth + penugasan aktif (peran & outlet) yang dipilih.
// Pilihan aktif disimpan di cookie dan selalu dicocokkan ulang dengan tabel penugasan.

const ACTIVE = "matur_active";

export type Assignment = { role: Role; outletId: string | null; outletNama: string };
export type Session = { userId: string; nama: string; status: string; assignments: Assignment[]; active: Assignment | null };

const key = (a: { role: string; outletId: string | null }) => `${a.role}|${a.outletId ?? ""}`;

export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profil }, { data: tugas }] = await Promise.all([
    supabase.from("pengguna").select("nama, status").eq("id", user.id).single(),
    supabase.from("penugasan").select("peran, outlet_id, outlet(nama)").eq("pengguna_id", user.id),
  ]);
  const status = profil?.status ?? "menunggu";
  // akun menunggu/ditolak/nonaktif tidak punya peran yang berlaku
  const assignments: Assignment[] = (status === "aktif" ? (tugas ?? []) : []).map((t) => ({
    role: t.peran as Role,
    outletId: t.outlet_id,
    outletNama: (t.outlet as unknown as { nama: string } | null)?.nama ?? "Semua Outlet",
  }));

  const chosen = (await cookies()).get(ACTIVE)?.value;
  const active = assignments.find((a) => key(a) === chosen) ?? (assignments.length === 1 ? assignments[0] : null);
  return { userId: user.id, nama: profil?.nama ?? user.email ?? "", status, assignments, active };
});

export async function setActive(a: { role: string; outletId: string | null } | null) {
  const store = await cookies();
  if (!a) store.delete(ACTIVE);
  else store.set(ACTIVE, key(a), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
}
