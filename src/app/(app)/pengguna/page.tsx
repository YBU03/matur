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
  const [
    { data: users, error: usersError },
    { data: tugas, error: tugasError },
    { data: outlets, error: outletsError },
  ] = await Promise.all([
    supabase
      .from("pengguna")
      .select("id, nama, email, no_hp, status, permintaan, created_at")
      .neq("status", "dihapus")
      .eq("akun_tablet", false)
      .order("nama"),
    supabase.from("penugasan").select("id, pengguna_id, peran, outlet_id"),
    supabase
      .from("outlet")
      .select("id, nama")
      .eq("mode", "asli")
      .is("deleted_at", null)
      .order("nama"),
  ]);
  if (usersError || tugasError || outletsError)
    throw new Error(
      "Daftar pengguna belum dapat dimuat: " +
        (usersError ?? tugasError ?? outletsError)!.message,
    );
  // HRD & Admin Gudang hanya mengelola akun kasir/barista dan pendaftar karyawan outlet
  const staf = s.active.role === "hrd" || s.active.role === "admin_gudang";
  let ids: Set<string> | null = null;
  if (staf) {
    const { data, error } = await supabase.rpc("id_staf_outlet");
    if (error) throw new Error(error.message);
    ids = new Set(((data ?? []) as unknown as string[]).map(String));
  }
  // Alamat hanya dikirim ke Owner/Admin Pusat, bukan peran pengelola akun staf.
  const profiles = !staf ? await supabase.from("profil_karyawan").select("pengguna_id,foto_path,alamat_ktp,alamat_domisili") : { data: [] };
  if ("error" in profiles && profiles.error) throw new Error("Profil belum dapat dimuat: " + profiles.error.message);
  const profileMap = new Map(await Promise.all((profiles.data ?? []).map(async (p) => {
    const foto = p.foto_path ? await supabase.storage.from("profil").createSignedUrl(p.foto_path, 3600) : null;
    return [p.pengguna_id, { alamat_ktp: p.alamat_ktp, alamat_domisili: p.alamat_domisili, foto_url: foto?.data?.signedUrl ?? null }] as const;
  })));
  const rows: UserRow[] = (users ?? [])
    .filter(
      (u) =>
        !ids ||
        ids.has(u.id) ||
        (u.status === "menunggu" &&
          (u.permintaan as { jenis?: string } | null)?.jenis === "staf_outlet"),
    )
    .map((u) => ({
      ...u,
      ...profileMap.get(u.id),
      assignments: (tugas ?? []).filter((t) => t.pengguna_id === u.id),
    }));
  return (
    <>
      <LiveRefresh pantau={[{ table: "pengguna" }, { table: "penugasan" }, { table: "profil_karyawan" }]} />
      <UserAdmin
        users={rows}
        outlets={outlets ?? []}
        isOwner={s.active.role === "owner"}
        staf={staf}
        meId={s.userId}
      />
    </>
  );
}
