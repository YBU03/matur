"use client";

import { useState, type ReactNode } from "react";

/** Di HP: kotak tertutup yang dibuka dengan ketuk. Di desktop (lg ke atas): isi selalu tampil tanpa tombol. */
export function LipatHp({ judul, ikon, ringkas, aktif = true, awalBuka = false, children }: { judul: string; ikon?: string; ringkas?: ReactNode; aktif?: boolean; awalBuka?: boolean; children: ReactNode }) {
  const [buka, setBuka] = useState(awalBuka);
  if (!aktif) return <>{children}</>;
  return (
    <div>
      <button
        type="button"
        onClick={() => setBuka(!buka)}
        aria-expanded={buka}
        className={`flex w-full items-center gap-3 rounded-2xl border border-matur-100 bg-white px-4 py-3 text-left shadow-sm transition active:scale-[.99] lg:hidden ${buka ? "rounded-b-none border-b-0" : ""}`}
      >
        {ikon && <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-matur-50 text-lg">{ikon}</span>}
        <span className="min-w-0 flex-1">
          <span className="block font-bold text-kopi-900">{judul}</span>
          {ringkas && <span className="block truncate text-xs text-stone-500">{ringkas}</span>}
        </span>
        <span className={`text-stone-400 transition-transform ${buka ? "rotate-90" : ""}`} aria-hidden>
          ›
        </span>
      </button>
      <div className={`${buka ? "[&>*]:rounded-t-none" : "hidden"} lg:block lg:[&>*]:rounded-t-2xl`}>{children}</div>
    </div>
  );
}
