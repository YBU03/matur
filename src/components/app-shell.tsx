"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BottomBar, type QuickItem } from "./bottom-bar";
import { LogoutButton } from "./logout-button";
import { IkonHamburger, SidebarCtx } from "./sidebar-ctx";

/** Sidebar di desktop; di HP menjadi laci yang dibuka lewat tombol hamburger. */
export function AppShell({ sidebar, title, quick, aksi, children }: { sidebar: React.ReactNode; title: string; quick: QuickItem[]; /** tombol di header (mis. lonceng notifikasi) */ aksi?: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => { try { setCollapsed(localStorage.getItem("matoer:sidebar-collapsed") === "1"); } catch {} }, []);
  const toggleSidebar = () => setCollapsed(value => { const next = !value; try { localStorage.setItem("matoer:sidebar-collapsed", next ? "1" : "0"); } catch {} return next; });
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const resize = () => { if (media.matches) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    media.addEventListener("change", resize); window.addEventListener("keydown", escape);
    return () => { media.removeEventListener("change", resize); window.removeEventListener("keydown", escape); };
  }, []);
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
        <button onClick={() => setOpen(true)} aria-label="Buka menu" aria-expanded={open} className="grid size-10 place-items-center rounded-xl text-kopi-800 transition-colors hover:bg-matur-50 focus-visible:outline-2 focus-visible:outline-matur-500">
          <IkonHamburger />
        </button>
        <Image src="/brand/logo-192.png" alt="" width={30} height={30} className="rounded-lg" />
        <span className="min-w-0 flex-1 truncate font-bold">{title}</span>
        {aksi}
        <LogoutButton />
      </header>

      {/* laci menu HP */}
      <div className={`fixed inset-0 z-40 lg:hidden ${open ? "" : "pointer-events-none"}`} aria-hidden={!open} inert={!open}>
        <div onClick={() => setOpen(false)} className={`absolute inset-0 bg-kopi-900/40 backdrop-blur-[2px] transition-opacity duration-200 motion-reduce:transition-none ${open ? "opacity-100" : "opacity-0"}`} />
        <aside className={`absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col overflow-y-auto bg-white [&>*]:shrink-0 shadow-2xl transition-transform duration-200 ease-out motion-reduce:transition-none ${open ? "translate-x-0" : "-translate-x-full"}`}>
          <SidebarCtx.Provider value={{ ringkas: false, hp: true, tutup: () => setOpen(false) }}>{sidebar}</SidebarCtx.Provider>
        </aside>
      </div>

      <aside
        id="desktop-sidebar"
        aria-label="Menu samping"
        className={`hidden border-r border-matur-200 bg-white transition-[width] duration-200 ease-out motion-reduce:transition-none lg:sticky lg:top-0 lg:flex lg:h-screen lg:shrink-0 lg:flex-col [&>*]:shrink-0 lg:overflow-y-auto lg:overflow-x-hidden ${collapsed ? "lg:w-[76px]" : "lg:w-64"}`}
      >
        <SidebarCtx.Provider value={{ ringkas: collapsed, hp: false, toggle: toggleSidebar }}>{sidebar}</SidebarCtx.Provider>
      </aside>
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
