"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { kelompokkanMenuAdmin } from "@/lib/sidebar-navigation";
import { CURRENT_STAGE, type MenuItem } from "@/lib/roles";
import { IkonMenu } from "./menu-ikon";
import { useSidebar } from "./sidebar-ctx";

// cocokkan tanpa beda huruf besar/kecil & tanda baca: "stok gud" → "Stok Gudang"
const normal = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export function SideNav({
  items,
  grouped = false,
}: {
  items: MenuItem[];
  grouped?: boolean;
}) {
  const path = usePathname();
  const router = useRouter();
  const [q, setQ] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const { ringkas, toggle } = useSidebar();
  const [tip, setTip] = useState<{ label: string; x: number; y: number } | null>(null);
  const kata = normal(q).split(" ").filter(Boolean);
  const tampil = kata.length
    ? items.filter((m) => kata.every((k) => normal(m.label).includes(k)))
    : items;

  const groups = grouped
    ? kelompokkanMenuAdmin(tampil)
    : [{ title: "", items: tampil }];
  const firstResult = groups[0]?.items[0];

  // tekan "/" di mana saja untuk langsung mencari menu
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (
        e.key === "/" &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) &&
        !t.isContentEditable
      ) {
        const el = input.current;
        // dua salinan menu (laci HP & sidebar desktop): fokus hanya yang terlihat
        if (
          !el ||
          el.offsetParent === null ||
          el.getBoundingClientRect().right <= 0
        )
          return;
        e.preventDefault();
        el.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (ringkas) {
    // mode rel ikon: ikon saja, nama menu muncul sebagai label melayang saat diarahkan
    const tampilTip = (label: string, e: React.MouseEvent | React.FocusEvent) => {
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setTip({ label, x: r.right + 10, y: r.top + r.height / 2 });
    };
    return (
      <nav aria-label="Menu utama" className="flex flex-1 flex-col items-center gap-1 px-2 pb-4">
        <button
          type="button"
          onClick={() => {
            toggle?.();
            setTimeout(() => input.current?.focus(), 220);
          }}
          onMouseEnter={(e) => tampilTip("Cari menu ( / )", e)}
          onMouseLeave={() => setTip(null)}
          aria-label="Cari menu"
          className="mb-1 grid size-11 place-items-center rounded-xl text-kopi-700 transition-colors hover:bg-matur-50 focus-visible:outline-2 focus-visible:outline-matur-500"
        >
          <IkonMenu nama="cari" label="Cari" />
        </button>
        {groups.map((group, gi) => (
          <div key={group.title || "menu"} role={group.title ? "group" : undefined} aria-label={group.title || undefined} className="flex w-full flex-col items-center gap-1">
            {gi > 0 && <span aria-hidden className="my-1.5 h-px w-8 bg-matur-200" />}
            {group.items.map((m) => {
              const active = path === m.href || path.startsWith(m.href + "/");
              return (
                <Link
                  key={m.href + m.label}
                  href={m.href}
                  aria-label={m.label}
                  aria-current={active ? "page" : undefined}
                  onMouseEnter={(e) => tampilTip(m.label, e)}
                  onMouseLeave={() => setTip(null)}
                  onFocus={(e) => tampilTip(m.label, e)}
                  onBlur={() => setTip(null)}
                  className={`grid size-11 place-items-center rounded-xl transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-matur-500 ${active ? "bg-matur-500 text-white shadow-sm" : "text-kopi-700 hover:bg-matur-50 hover:text-kopi-900"}`}
                >
                  <IkonMenu href={m.href} label={m.label} />
                </Link>
              );
            })}
          </div>
        ))}
        {tip && (
          <span role="tooltip" style={{ left: tip.x, top: tip.y }} className="pointer-events-none fixed z-50 -translate-y-1/2 whitespace-nowrap rounded-lg bg-kopi-900 px-2.5 py-1.5 text-xs font-semibold text-white shadow-lg">
            {tip.label}
          </span>
        )}
      </nav>
    );
  }

  return (
    <nav aria-label="Menu utama" className="flex flex-col gap-1 px-3">
      <div className="sticky top-0 z-10 -mx-3 mb-1 bg-white px-3 pb-2 pt-1">
        <IkonMenu nama="cari" label="Cari" className="pointer-events-none absolute left-6 top-1/2 -mt-0.5 -translate-y-1/2 text-stone-400" />
        <input
          ref={input}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && firstResult) {
              router.push(firstResult.href);
              setQ("");
              input.current?.blur();
            }
            if (e.key === "Escape") setQ("");
          }}
          placeholder="Cari menu…  ( / )"
          aria-label="Cari menu"
          className="w-full rounded-xl border border-matur-200 bg-white px-3 py-2 pl-9 text-sm outline-none transition-colors focus:border-matur-500 focus:ring-2 focus:ring-matur-100"
        />
      </div>
      {groups.map((group, groupIndex) => (
        <div
          key={group.title || "menu"}
          role={group.title ? "group" : undefined}
          aria-label={group.title || undefined}
          className="flex flex-col gap-1"
        >
          {group.title && (
            <h2
              className={`px-3 pb-1 pt-3 text-xs font-bold uppercase tracking-wide text-kopi-700 ${groupIndex > 0 ? "mt-2 border-t border-matur-200" : ""}`}
            >
              {group.title}
            </h2>
          )}
          {group.items.map((m) => {
            const active = path === m.href || path.startsWith(m.href + "/");
            return (
              <Link
                key={m.href}
                href={m.href}
                aria-current={active ? "page" : undefined}
                onClick={() => setQ("")}
                className={`flex items-center gap-3 ${grouped ? "whitespace-normal break-words leading-5" : "whitespace-nowrap"} rounded-xl px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-matur-500 ${active ? "bg-matur-500 text-white" : q && m === firstResult ? "bg-matur-100 text-kopi-900" : "text-kopi-700 hover:bg-matur-50"}`}
              >
                <IkonMenu href={m.href} label={m.label} className={active ? "" : "text-matur-600"} />
                <span className="min-w-0 flex-1">{m.label}</span>
                {m.stage > CURRENT_STAGE && (
                  <span className="ml-1 text-xs opacity-60">🔒</span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
      {!tampil.length && (
        <p className="px-3 py-2 text-sm text-stone-400">
          Menu tidak ditemukan.
        </p>
      )}
    </nav>
  );
}
