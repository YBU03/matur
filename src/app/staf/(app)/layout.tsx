import { redirect } from "next/navigation";
import { LiveRefresh } from "@/components/live-refresh";
import { MaintenanceScreen } from "@/components/maintenance-screen";
import { StafShell } from "@/components/staf/shell";
import { stafLogoutAction } from "@/lib/actions";
import { statusMaintenance } from "@/lib/maintenance";
import { POS_ROLES, ROLES } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

// Aplikasi staf kasir & barista (HP pribadi): beranda, jadwal, absen, pengajuan, profil.
// Bentuk & tata letak mengikuti aplikasi host Makaryo; warna mengikuti Matoer.
export default async function StafLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  if (!s) redirect("/staf/login");
  if (!s.active?.outletId || !POS_ROLES.includes(s.active.role)) redirect("/staf/pilih");
  const m = await statusMaintenance();
  if (m.aktif) return <MaintenanceScreen pesan={m.pesan} />;

  const supabase = await supabaseServer();
  const [{ count: belumDibaca }, { count: tukarMasuk }] = await Promise.all([
    supabase.from("notifikasi").select("id", { count: "exact", head: true }).eq("pengguna_id", s.userId).is("dibaca_at", null),
    supabase.from("tukar_shift").select("id", { count: "exact", head: true }).eq("rekan_id", s.userId).eq("status", "menunggu_rekan"),
  ]);
  const badge = { "/staf/pengajuan": tukarMasuk ?? 0 };

  return (
    <StafShell
      nama={s.nama}
      peran={ROLES[s.active.role].label}
      outlet={s.active.outletNama}
      belumDibaca={belumDibaca ?? 0}
      badge={badge}
      keluar={stafLogoutAction}
      atas={<LiveRefresh pantau={[{ table: "notifikasi", filter: `pengguna_id=eq.${s.userId}` }]} cadanganDetik={120} />}
    >
      {children}
    </StafShell>
  );
}
