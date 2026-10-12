"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type QuickItem = { href: string; label: string };

const ICON: [RegExp, string][] = [
  [/^\/dashboard/, "🏠"],
  [/proyek|pembangunan/, "🏗️"],
  [/gudang|bahan/, "📦"],
  [/pengguna/, "👥"],
  [/master\/menu|kategori_menu|varian|resep/, "☕"],
  [/outlet/, "🏪"],
  [/mitra|perjanjian/, "🤝"],
  [/karyawan|jadwal|absensi/, "🧑‍🍳"],
  [/kasir|pos/, "🧾"],
  [/laporan|biaya|tutup-buku|transfer|bep/, "📊"],
  [/supplier/, "🚚"],
  [/log/, "📜"],
];
const icon = (href: string) => ICON.find(([r]) => r.test(href))?.[1] ?? "•";
const pendek = (l: string) => l.replace(/ & .*| \(.*\)/, "").replace("Proyek Pembangunan", "Proyek").replace("Progres Pembangunan", "Proyek").replace("Pengguna", "Akun").replace("Stok Gudang", "Stok");

/** Tombol melayang di bawah layar (HP/tablet): pintasan menu utama + tombol buka semua menu. */
export function BottomBar({ items, onMenu }: { items: QuickItem[]; onMenu: () => void }) {
  const path = usePathname();
  return (
    <nav
      aria-label="Pintasan"
      className="fixed inset-x-3 bottom-3 z-30 mx-auto flex max-w-md items-stretch justify-around rounded-2xl border border-matur-200 bg-white/95 p-1.5 shadow-[0_8px_30px_rgba(90,52,23,0.18)] backdrop-blur lg:hidden"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      {items.map((i) => {
        const on = path === i.href || path.startsWith(i.href + "/");
        return (
          <Link
            key={i.href}
            href={i.href}
            className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[11px] font-semibold ${on ? "bg-matur-500 text-white" : "text-kopi-700 active:bg-matur-50"}`}
          >
            <span className="text-lg leading-none" aria-hidden>{icon(i.href)}</span>
            <span className="max-w-full truncate">{pendek(i.label)}</span>
          </Link>
        );
      })}
      <button onClick={onMenu} className="flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[11px] font-semibold text-kopi-700 active:bg-matur-50">
        <span className="text-lg leading-none" aria-hidden>☰</span>
        <span>Menu</span>
      </button>
    </nav>
  );
}
