import { SidebarBawah, SidebarKepala, SidebarProfil } from "@/components/sidebar-ctx";
import Link from "next/link";
import { headers } from "next/headers";
import { PANTAU_POS, POS_ONLY, POS_ROLES, ROLES } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { isAdminDashboardRole, mobileQuickLinks } from "@/lib/dashboard-navigation";
import { Lonceng } from "@/components/lonceng";
import { Alihkan } from "@/components/alihkan";
import { AppShell } from "@/components/app-shell";
import { InstallButton } from "@/components/install-button";
import { SideNav } from "@/components/side-nav";
import { MaintenanceScreen } from "@/components/maintenance-screen";
import { KEBAL_MAINTENANCE, statusMaintenance } from "@/lib/maintenance";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  if (!s) return <Alihkan ke="/login" />;
  if (s.assignments.length === 0) return <Alihkan ke="/menunggu" />;
  if (!s.active) return <Alihkan ke="/pilih-peran" />;
  if (s.active.role === "tablet") return <Alihkan ke="/pos" />;
  if (POS_ONLY.includes(s.active.role)) return <Alihkan ke="/karyawan" />;
  if (s.active.role === "pemantau_pos") {
    const path = (await headers()).get("x-matur-pathname") ?? "";
    if (![PANTAU_POS, "/profil"].some((p) => path === p || path.startsWith(p + "/"))) return <Alihkan ke={PANTAU_POS} />;
  }
  if (!KEBAL_MAINTENANCE.includes(s.active.role)) {
    const m = await statusMaintenance();
    if (m.aktif) return <MaintenanceScreen pesan={m.pesan} />;
  }
  const r = ROLES[s.active.role];

  const sidebar = (
    <>
      <SidebarKepala />
      <SidebarProfil nama={s.nama} peran={r.label} outlet={s.active.outletNama} mascot={r.mascot} />
      <SideNav items={r.menu} grouped={isAdminDashboardRole(s.active.role)} />
      <SidebarBawah>
        {/* Aplikasi kasir (POS) terpisah di /kasir — untuk akun yang bertugas sebagai kasir/barista/SPV */}
        {s.assignments.some((a) => POS_ROLES.includes(a.role) && a.outletId) && (
          <Link href="/pos" className="flex items-center justify-center gap-2 rounded-xl bg-red-600 px-3 py-2 font-semibold text-white hover:bg-red-700">
            🧾 Buka POS Kasir (tablet outlet)
          </Link>
        )}
        <InstallButton />
        {s.assignments.length > 1 && (
          <Link href="/pilih-peran" className="inline-block rounded-lg border border-matur-300 px-3 py-1.5 hover:bg-matur-50">
            Ganti peran
          </Link>
        )}
      </SidebarBawah>
    </>
  );

  const quick = mobileQuickLinks(s.active.role);

  return (
    <AppShell sidebar={sidebar} title={`Matoer · ${r.label}`} quick={quick} aksi={isAdminDashboardRole(s.active.role) ? <Lonceng userId={s.userId} /> : undefined}>
      {children}
    </AppShell>
  );
}
