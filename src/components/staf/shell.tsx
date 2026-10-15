import Image from "next/image";
import Link from "next/link";
import { Bell, LogOut } from "lucide-react";
import { InstallButton } from "@/components/install-button";
import { NavBawah, NavSamping } from "./nav";
import { Avatar } from "./ui";

/** Kerangka aplikasi staf: header + pil bawah di HP, sidebar di desktop (pola AppShell host Makaryo). */
export function StafShell({ nama, peran, outlet, belumDibaca, badge, keluar, atas, children }: { nama: string; peran: string; outlet: string; belumDibaca: number; badge: Record<string, number>; keluar: (fd: FormData) => void | Promise<void>; atas?: React.ReactNode; children: React.ReactNode }) {
  const lonceng = (
    <Link href="/staf/notifikasi" className="relative grid size-11 place-items-center rounded-full hover:bg-matur-50" aria-label={`Notifikasi${belumDibaca ? `, ${belumDibaca} belum dibaca` : ""}`}>
      <Bell className="size-5 text-kopi-900" aria-hidden />
      {!!belumDibaca && <span className="absolute right-1.5 top-1.5 min-w-4 rounded-full bg-red-500 px-1 text-center text-[10px] font-bold leading-4 text-white">{belumDibaca > 9 ? "9+" : belumDibaca}</span>}
    </Link>
  );

  return (
    <div className="min-h-dvh bg-krem">
      {atas}
      {/* sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] flex-col border-r border-garis bg-white p-4 lg:flex">
        <Link href="/staf" className="mb-6 flex items-center gap-2 px-2">
          <Image src="/brand/logo-192.png" alt="" width={36} height={36} className="rounded-xl" />
          <span className="leading-tight">
            <span className="block text-lg font-extrabold text-kopi-900">Matoer</span>
            <span className="block text-[11px] font-semibold text-redup">Aplikasi Staf</span>
          </span>
        </Link>
        <NavSamping badge={badge} />
        <div className="mt-auto space-y-3">
          <InstallButton />
          <div className="flex items-center gap-2 rounded-2xl bg-krem p-2">
            <Avatar nama={nama} />
            <div className="min-w-0 flex-1 text-sm">
              <p className="truncate font-semibold text-kopi-900">{nama}</p>
              <p className="truncate text-[11px] text-redup">
                {peran} · {outlet}
              </p>
            </div>
            {lonceng}
          </div>
          <form action={keluar}>
            <button className="flex w-full items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">
              <LogOut className="size-4" aria-hidden /> Keluar
            </button>
          </form>
        </div>
      </aside>

      <div className="lg:pl-[260px]">
        {/* header HP */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-garis bg-krem/90 px-4 backdrop-blur lg:hidden">
          <Link href="/staf" className="flex items-center gap-2">
            <Image src="/brand/logo-192.png" alt="" width={32} height={32} className="rounded-xl" />
            <span className="text-base font-extrabold text-kopi-900">Matoer</span>
          </Link>
          <div className="ml-auto flex items-center gap-1">
            {lonceng}
            <Link href="/staf/profil" aria-label="Profil">
              <Avatar nama={nama} />
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl px-4 pb-32 pt-5 sm:px-6 lg:px-8 lg:pb-10 lg:pt-8">{children}</main>
      </div>
      <NavBawah badge={badge} />
    </div>
  );
}
