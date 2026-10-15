"use client";

// Navigasi Ruang Karyawan: pil melayang di bawah (HP) dan sidebar kiri (≥1024px), seperti aplikasi host Makaryo.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ClipboardList, Grid2x2, House, PackageCheck, Receipt, ScanFace, UserRound, Wallet, Warehouse, type LucideIcon } from "lucide-react";

export type MenuKaryawan = { href: string; label: string; ikon: keyof typeof IKON; bawah?: boolean };

const IKON = { House, CalendarDays, ScanFace, ClipboardList, Grid2x2, Receipt, PackageCheck, Wallet, Warehouse, UserRound } satisfies Record<string, LucideIcon>;

export const MENU_KARYAWAN: MenuKaryawan[] = [
  { href: "/karyawan", label: "Beranda", ikon: "House", bawah: true },
  { href: "/karyawan/jadwal", label: "Jadwal", ikon: "CalendarDays", bawah: true },
  { href: "/karyawan/absen", label: "Absen", ikon: "ScanFace", bawah: true },
  { href: "/karyawan/izin", label: "Izin & Tukar", ikon: "ClipboardList", bawah: true },
  { href: "/karyawan/slip", label: "Slip Gaji", ikon: "Receipt" },
  { href: "/karyawan/kiriman", label: "Terima Barang", ikon: "PackageCheck" },
  { href: "/karyawan/setoran", label: "Setoran", ikon: "Wallet" },
  { href: "/karyawan/stok", label: "Stok Outlet", ikon: "Warehouse" },
  { href: "/karyawan/profil", label: "Profil", ikon: "UserRound" },
];

const aktif = (path: string, href: string) => (href === "/karyawan" ? path === "/karyawan" : path === href || path.startsWith(href + "/"));

export function NavBawah({ badge }: { badge: Record<string, number> }) {
  const path = usePathname();
  const utama = MENU_KARYAWAN.filter((m) => m.bawah);
  const lainnyaAktif = path === "/karyawan/lainnya" || MENU_KARYAWAN.some((m) => !m.bawah && aktif(path, m.href));
  const item = (href: string, label: string, Ikon: LucideIcon, on: boolean, titik?: number) => (
    <li key={href} className="flex-1">
      <Link
        href={href}
        aria-current={on ? "page" : undefined}
        className={`relative flex h-12 flex-col items-center justify-center gap-0.5 rounded-full transition-colors ${on ? "bg-matur-500 text-white" : "text-white/70 hover:text-white"}`}
      >
        <Ikon className="size-5" aria-hidden />
        <span className="text-[10px] font-semibold leading-none">{label}</span>
        {!!titik && <span className="absolute right-2 top-1 size-2 rounded-full bg-red-500" aria-label={`${titik} baru`} />}
      </Link>
    </li>
  );
  return (
    <nav aria-label="Navigasi utama" className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:hidden">
      <ul className="mx-auto flex max-w-md items-center justify-between gap-1 rounded-full bg-kopi-900 px-2.5 py-2 shadow-[var(--shadow-melayang)]">
        {utama.map((m) => item(m.href, m.label === "Izin & Tukar" ? "Izin" : m.label, IKON[m.ikon], aktif(path, m.href), badge[m.href]))}
        {item("/karyawan/lainnya", "Lainnya", Grid2x2, lainnyaAktif)}
      </ul>
    </nav>
  );
}

export function NavSamping({ badge, tambahan }: { badge: Record<string, number>; tambahan?: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <ul className="space-y-1">
      {MENU_KARYAWAN.map(({ href, label, ikon }) => {
        const Ikon = IKON[ikon];
        const on = aktif(path, href);
        return (
          <li key={href}>
            <Link href={href} aria-current={on ? "page" : undefined} className={`flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-semibold ${on ? "bg-matur-500 text-white shadow-sm" : "text-kopi-700 hover:bg-matur-50"}`}>
              <Ikon className="size-5" aria-hidden />
              <span className="flex-1">{label}</span>
              {!!badge[href] && <span className={`rounded-full px-2 text-[11px] font-bold ${on ? "bg-white text-matur-700" : "bg-red-500 text-white"}`}>{badge[href]}</span>}
            </Link>
          </li>
        );
      })}
      {tambahan?.map((t) => (
        <li key={t.href}>
          <Link href={t.href} className="flex items-center gap-3 rounded-full border border-garis px-4 py-2.5 text-sm font-semibold text-kopi-900 hover:bg-matur-50">
            <Receipt className="size-5" aria-hidden />
            {t.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
