"use client";

// Kepala, profil & bagian bawah menu samping — menyesuaikan mode lebar / ringkas (rel ikon) / laci HP.
import Image from "next/image";
import Link from "next/link";
import { createContext, useContext } from "react";

export type ModeSidebar = { ringkas: boolean; hp: boolean; toggle?: () => void; tutup?: () => void };
export const SidebarCtx = createContext<ModeSidebar>({ ringkas: false, hp: false });
export const useSidebar = () => useContext(SidebarCtx);

/** Ikon garis tiga — presisi di kisi 24px. */
export function IkonHamburger({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className}>
      <path d="M4 6.5h16M4 12h16M4 17.5h16" />
    </svg>
  );
}

/** Ikon panel samping: panah kiri = lipat, panah kanan = buka. */
export function IkonPanel({ buka }: { buka: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <path d="M9.5 4.5v15" />
      <path d={buka ? "M14.5 10l2 2-2 2" : "M16.5 10l-2 2 2 2"} />
    </svg>
  );
}

const tombolIkon =
  "grid size-9 shrink-0 place-items-center rounded-xl text-kopi-700 transition-colors hover:bg-matur-50 hover:text-kopi-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-matur-500";

export function SidebarKepala({ nama = "Matoer" }: { nama?: string }) {
  const { ringkas, hp, toggle, tutup } = useSidebar();
  if (ringkas)
    return (
      <div className="flex flex-col items-center gap-2 border-b border-matur-100 px-2 py-3">
        <Image src="/brand/logo-192.png" alt={nama} width={36} height={36} className="rounded-xl" />
        <button type="button" onClick={toggle} aria-label="Buka menu samping" title="Buka menu" className={tombolIkon}>
          <IkonPanel buka />
        </button>
      </div>
    );
  return (
    <div className="flex h-16 items-center gap-2.5 border-b border-matur-100 px-4">
      <Image src="/brand/logo-192.png" alt="" width={34} height={34} className="rounded-xl" />
      <span className="min-w-0 flex-1 truncate text-lg font-extrabold tracking-tight text-kopi-900">{nama}</span>
      {hp ? (
        <button type="button" onClick={tutup} aria-label="Tutup menu" className={tombolIkon}>
          <svg aria-hidden viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      ) : (
        <button type="button" onClick={toggle} aria-label="Lipat menu samping" title="Lipat menu" className={tombolIkon}>
          <IkonPanel buka={false} />
        </button>
      )}
    </div>
  );
}

export function SidebarProfil({ nama, peran, outlet, mascot }: { nama: string; peran: string; outlet: string; mascot: string }) {
  const { ringkas } = useSidebar();
  if (ringkas)
    return (
      <Link href="/profil" title={`${nama} · ${peran}`} aria-label="Profil saya" className="mx-auto my-3 block rounded-xl ring-1 ring-matur-200 transition hover:ring-matur-400">
        <Image src={`/mascot/${mascot}.png`} alt="" width={40} height={40} className="rounded-xl" />
      </Link>
    );
  return (
    <Link href="/profil" className="mx-3 my-3 flex items-center gap-3 rounded-2xl border border-matur-100 bg-matur-50/70 p-2.5 transition-colors hover:border-matur-200 hover:bg-matur-50" title="Profil saya">
      <Image src={`/mascot/${mascot}.png`} alt="" width={42} height={42} className="rounded-xl" />
      <div className="min-w-0 flex-1 text-sm leading-tight">
        <p className="truncate font-semibold text-kopi-900">{nama}</p>
        <p className="mt-0.5 truncate text-xs text-stone-500">
          {peran} · {outlet}
        </p>
        <p className="mt-1 text-xs font-semibold text-matur-700">Profil saya ›</p>
      </div>
    </Link>
  );
}

/** Bagian bawah (tombol POS, instal, ganti peran): disembunyikan di mode rel ikon. */
export function SidebarBawah({ children }: { children: React.ReactNode }) {
  const { ringkas } = useSidebar();
  if (ringkas) return null;
  return <div className="space-y-2 border-t border-matur-100 p-4 text-sm">{children}</div>;
}
