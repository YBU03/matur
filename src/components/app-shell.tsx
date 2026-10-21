"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BottomBar, type QuickItem } from "./bottom-bar";
import { LogoutButton } from "./logout-button";

/** Sidebar di desktop; di HP menjadi laci yang dibuka lewat tombol hamburger. */
export function AppShell({ sidebar, title, quick, aksi, children }: { sidebar: React.ReactNode; title: string; quick: QuickItem[]; /** tombol di header (mis. lonceng notifikasi) */ aksi?: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="min-h-screen lg:flex">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-matur-200 bg-white/95 px-3 py-2 backdrop-blur lg:hidden">
        <button onClick={() => setOpen(true)} aria-label="Buka menu" aria-expanded={open} className="grid size-10 place-items-center rounded-xl hover:bg-matur-50">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        <Image src="/brand/logo-192.png" alt="" width={30} height={30} className="rounded-lg" />
        <span className="min-w-0 flex-1 truncate font-bold">{title}</span>
        {aksi}
        <LogoutButton />
      </header>

      {/* laci menu HP */}
      <div className={`fixed inset-0 z-40 lg:hidden ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
        <div onClick={() => setOpen(false)} className={`absolute inset-0 bg-black/40 transition-opacity ${open ? "opacity-100" : "opacity-0"}`} />
        <aside className={`absolute inset-y-0 left-0 w-72 max-w-[85vw] overflow-y-auto bg-white shadow-2xl transition-transform ${open ? "translate-x-0" : "-translate-x-full"}`}>
          <button onClick={() => setOpen(false)} aria-label="Tutup menu" className="absolute right-3 top-3 grid size-9 place-items-center rounded-lg text-stone-500 hover:bg-stone-100">
            ✕
          </button>
          {sidebar}
        </aside>
      </div>

      <aside className="hidden border-r border-matur-200 bg-white lg:sticky lg:top-0 lg:block lg:h-screen lg:w-64 lg:shrink-0 lg:overflow-y-auto">{sidebar}</aside>
      <main className="min-w-0 flex-1 p-4 pb-28 sm:p-6 sm:pb-28 lg:p-8 lg:pt-4">
        <div className="mb-4 hidden items-center justify-end gap-2 lg:flex">
          {aksi}
          <LogoutButton />
        </div>
        {children}
      </main>
      <BottomBar items={quick} onMenu={() => setOpen(true)} />
    </div>
  );
}
