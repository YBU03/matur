import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CURRENT_STAGE, POS_ONLY, POS_ROLES, ROLES } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { AppShell } from "@/components/app-shell";
import { InstallButton } from "@/components/install-button";
import { SideNav } from "@/components/side-nav";
import { MaintenanceScreen } from "@/components/maintenance-screen";
import { KEBAL_MAINTENANCE, statusMaintenance } from "@/lib/maintenance";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.assignments.length === 0) redirect("/menunggu");
  if (!s.active) redirect("/pilih-peran");
  if (POS_ONLY.includes(s.active.role)) redirect("/karyawan");
  if (!KEBAL_MAINTENANCE.includes(s.active.role)) {
    const m = await statusMaintenance();
    if (m.aktif) return <MaintenanceScreen pesan={m.pesan} />;
  }
  const r = ROLES[s.active.role];

  const sidebar = (
    <>
      <div className="flex items-center gap-2 p-4">
        <Image src="/brand/logo-192.png" alt="Matoer" width={36} height={36} className="rounded-lg" />
        <span className="text-lg font-bold">Matoer</span>
      </div>
      <Link href="/profil" className="mx-4 mb-3 flex items-center gap-3 rounded-xl bg-matur-50 p-2 hover:bg-matur-100" title="Profil saya">
        <Image src={`/mascot/${r.mascot}.png`} alt="" width={44} height={44} className="rounded-lg" />
        <div className="min-w-0 flex-1 text-sm">
          <p className="truncate font-semibold">{s.nama}</p>
          <p className="truncate text-xs text-stone-500">
            {r.label} · {s.active.outletNama}
          </p>
          <p className="text-xs font-medium text-matur-700">Profil saya ›</p>
        </div>
      </Link>
      <SideNav items={r.menu} />
      <div className="space-y-2 p-4 text-sm">
        {/* Aplikasi kasir (POS) terpisah di /kasir — untuk akun yang bertugas sebagai kasir/barista/SPV */}
        {s.assignments.some((a) => POS_ROLES.includes(a.role) && a.outletId) && (
          <Link href="/kasir/pos" className="flex items-center justify-center gap-2 rounded-xl bg-red-600 px-3 py-2 font-semibold text-white hover:bg-red-700">
            🧾 Buka POS Kasir (tablet outlet)
          </Link>
        )}
        <InstallButton />
        {s.assignments.length > 1 && (
          <Link href="/pilih-peran" className="inline-block rounded-lg border border-matur-300 px-3 py-1.5 hover:bg-matur-50">
            Ganti peran
          </Link>
        )}
      </div>
    </>
  );

  // 4 pintasan di tombol melayang bawah: Beranda + menu terpenting peran ini yang sudah tersedia
  const PRIORITAS = ["/proyek", "/portal/pembangunan", "/laporan", "/hpp-menu", "/gudang/stok", "/pengguna", "/kasir", "/absensi", "/jadwal", "/persetujuan", "/master/menu", "/master/perjanjian", "/master/karyawan", "/master/outlet"];
  const tersedia = r.menu.filter((m) => m.stage <= CURRENT_STAGE && m.href !== "/dashboard");
  const quick = [
    { href: "/dashboard", label: "Beranda" },
    ...[...tersedia].sort((a, b) => (PRIORITAS.indexOf(a.href) + 1 || 99) - (PRIORITAS.indexOf(b.href) + 1 || 99)).slice(0, 3),
  ];

  return (
    <AppShell sidebar={sidebar} title={`Matoer · ${r.label}`} quick={quick}>
      {children}
    </AppShell>
  );
}
