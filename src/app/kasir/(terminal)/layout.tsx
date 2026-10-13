import Image from "next/image";
import { redirect } from "next/navigation";
import { kasirLogoutAction } from "@/lib/actions";
import { POS_ROLES, ROLES, BISA_JUAL } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { InstallButton } from "@/components/install-button";
import { TerminalNav } from "./terminal-nav";

// Tampilan aplikasi POS: tanpa menu admin, khusus perangkat di outlet.
export default async function TerminalLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  if (!s?.active?.outletId || !POS_ROLES.includes(s.active.role)) redirect("/kasir");
  const items = [
    ...(BISA_JUAL.includes(s.active.role) ? [{ href: "/kasir/pos", label: "Kasir" }] : []),
    { href: "/kasir/antrean", label: "Antrean" },
    { href: "/kasir/shift", label: "Kas & Pengeluaran" },
  ];
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 flex flex-wrap items-center gap-3 border-b border-matur-200 bg-white px-4 py-2">
        <Image src="/brand/logo-192.png" alt="Matoer" width={32} height={32} className="rounded-lg" />
        <div className="mr-auto leading-tight">
          <p className="text-sm font-bold">Matoer POS · {s.active.outletNama}</p>
          <p className="text-xs text-stone-500">{s.nama} · {ROLES[s.active.role].label}</p>
        </div>
        <TerminalNav items={items} />
        <InstallButton className="!w-auto" />
        <form action={kasirLogoutAction}>
          <button className="rounded-lg px-3 py-1.5 text-sm text-red-600 hover:bg-red-50">Keluar</button>
        </form>
      </header>
      <main className="p-3 sm:p-4">{children}</main>
    </div>
  );
}
