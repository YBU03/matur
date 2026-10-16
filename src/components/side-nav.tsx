"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CURRENT_STAGE, type MenuItem } from "@/lib/roles";

// cocokkan tanpa beda huruf besar/kecil & tanda baca: "stok gud" → "Stok Gudang"
const normal = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export function SideNav({ items }: { items: MenuItem[] }) {
  const path = usePathname();
  const router = useRouter();
  const [q, setQ] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const kata = normal(q).split(" ").filter(Boolean);
  const tampil = kata.length
    ? items.filter((m) => kata.every((k) => normal(m.label).includes(k)))
    : items;

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

  return (
    <nav className="flex flex-col gap-1 px-3">
      <div className="sticky top-0 z-10 -mx-3 mb-1 bg-white px-3 pb-1 pt-1">
        <input
          ref={input}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && tampil[0]) {
              router.push(tampil[0].href);
              setQ("");
              input.current?.blur();
            }
            if (e.key === "Escape") setQ("");
          }}
          placeholder="🔍 Cari menu…  ( / )"
          aria-label="Cari menu"
          className="w-full rounded-lg border border-matur-200 bg-white px-3 py-2 text-sm outline-none focus:border-matur-500"
        />
      </div>
      {tampil.map((m, i) => {
        const active = path === m.href || path.startsWith(m.href + "/");
        return (
          <Link
            key={m.href}
            href={m.href}
            onClick={() => setQ("")}
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${
              active
                ? "bg-matur-500 text-white"
                : q && i === 0
                  ? "bg-matur-100 text-kopi-900"
                  : "text-kopi-700 hover:bg-matur-50"
            }`}
          >
            {m.label}
            {m.stage > CURRENT_STAGE && (
              <span className="ml-1 text-xs opacity-60">🔒</span>
            )}
          </Link>
        );
      })}
      {!tampil.length && (
        <p className="px-3 py-2 text-sm text-stone-400">
          Menu tidak ditemukan.
        </p>
      )}
    </nav>
  );
}
