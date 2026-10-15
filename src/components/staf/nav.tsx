"use client";

// Navigasi aplikasi staf: pil melayang di bawah (HP) dan sidebar kiri (≥1024px), seperti aplikasi host Makaryo.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ClipboardList, House, ScanFace, UserRound, type LucideIcon } from "lucide-react";

export const MENU_STAF: { href: string; label: string; ikon: LucideIcon }[] = [
  { href: "/staf", label: "Beranda", ikon: House },
  { href: "/staf/jadwal", label: "Jadwal", ikon: CalendarDays },
  { href: "/staf/absen", label: "Absen", ikon: ScanFace },
  { href: "/staf/pengajuan", label: "Pengajuan", ikon: ClipboardList },
  { href: "/staf/profil", label: "Profil", ikon: UserRound },
];

const aktif = (path: string, href: string) => (href === "/staf" ? path === "/staf" : path === href || path.startsWith(href + "/"));

export function NavBawah({ badge }: { badge: Record<string, number> }) {
  const path = usePathname();
  return (
    <nav aria-label="Navigasi utama" className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:hidden">
      <ul className="mx-auto flex max-w-md items-center justify-between gap-1 rounded-full bg-kopi-900 px-2.5 py-2 shadow-[var(--shadow-melayang)]">
        {MENU_STAF.map(({ href, label, ikon: Ikon }) => {
          const on = aktif(path, href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={on ? "page" : undefined}
                className={`relative flex h-12 flex-col items-center justify-center gap-0.5 rounded-full transition-colors ${on ? "bg-matur-500 text-white" : "text-white/70 hover:text-white"}`}
              >
                <Ikon className="size-5" aria-hidden />
                <span className="text-[10px] font-semibold leading-none">{label}</span>
                {!!badge[href] && <span className="absolute right-2 top-1 size-2 rounded-full bg-red-500" aria-label={`${badge[href]} baru`} />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function NavSamping({ badge }: { badge: Record<string, number> }) {
  const path = usePathname();
  return (
    <ul className="space-y-1">
      {MENU_STAF.map(({ href, label, ikon: Ikon }) => {
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
    </ul>
  );
}
