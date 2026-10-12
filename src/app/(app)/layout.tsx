import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { logoutAction } from "@/lib/actions";
import { CURRENT_STAGE, POS_ONLY, ROLES } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { AppShell } from "@/components/app-shell";
import { InstallButton } from "@/components/install-button";
import { SideNav } from "@/components/side-nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.assignments.length === 0) redirect("/menunggu");
  if (!s.active) redirect("/pilih-peran");
  if (POS_ONLY.includes(s.active.role)) redirect("/kasir");
  const r = ROLES[s.active.role];

  const sidebar = (
    <>
      <div className="flex items-center gap-2 p-4">
        <Image src="/brand/logo-192.png" alt="Matoer" width={36} height={36} className="rounded-lg" />
        <span className="text-lg font-bold">Matoer</span>
      </div>
      <div className="mx-4 mb-3 flex items-center gap-3 rounded-xl bg-matur-50 p-2">
        <Image src={`/mascot/${r.mascot}.png`} alt="" width={44} height={44} className="rounded-lg" />
        <div className="min-w-0 text-sm">
          <p className="truncate font-semibold">{s.nama}</p>
          <p className="truncate text-xs text-stone-500">
            {r.label} · {s.active.outletNama}
          </p>
        </div>
      </div>
      <SideNav items={r.menu} />
      <div className="space-y-2 p-4 text-sm">
        <InstallButton />
        <div className="flex gap-2">
          {s.assignments.length > 1 && (
            <Link href="/pilih-peran" className="rounded-lg border border-matur-300 px-3 py-1.5 hover:bg-matur-50">
              Ganti peran
            </Link>
          )}
          <form action={logoutAction}>
            <button className="rounded-lg px-3 py-1.5 text-red-600 hover:bg-red-50">Keluar</button>
          </form>
        </div>
      </div>
    </>
  );

  // 4 pintasan di tombol melayang bawah: Beranda + menu terpenting peran ini yang sudah tersedia
  const PRIORITAS = ["/proyek", "/portal/pembangunan", "/gudang/stok", "/pengguna", "/kasir", "/master/menu", "/master/perjanjian", "/master/karyawan", "/master/outlet"];
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
