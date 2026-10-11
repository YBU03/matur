"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export const PERIODE = [
  ["hari", "Hari ini"],
  ["7", "7 hari"],
  ["30", "30 hari"],
  ["bulan", "Bulan ini"],
  ["90", "90 hari"],
  ["12bln", "12 bulan"],
] as const;

// DSB-01: pilih cabang + rentang tanggal dalam satu baris di atas grafik
export function Filters({ outlets, canSim }: { outlets: { id: string; nama: string }[] | null; canSim: boolean }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const set = (k: string, v: string | null) => {
    const q = new URLSearchParams(sp);
    if (v === null) q.delete(k);
    else q.set(k, v);
    start(() => router.push(`${path}?${q}`, { scroll: false }));
  };
  const periode = sp.get("periode") ?? "30";
  const sim = sp.get("mode") === "simulasi";
  const chip = (on: boolean) => `rounded-lg px-3 py-1.5 text-sm font-medium ${on ? "bg-kopi-700 text-white" : "bg-white text-kopi-700 border border-matur-200"}`;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${pending ? "opacity-60" : ""}`}>
      {outlets && (
        <select value={sp.get("outlet") ?? ""} onChange={(e) => set("outlet", e.target.value || null)} className="rounded-lg border border-matur-200 bg-white px-3 py-1.5 text-sm">
          <option value="">Semua Outlet</option>
          {outlets.map((o) => (
            <option key={o.id} value={o.id}>{o.nama}</option>
          ))}
        </select>
      )}
      <div className="flex flex-wrap gap-1">
        {PERIODE.map(([k, l]) => (
          <button key={k} onClick={() => set("periode", k === "30" ? null : k)} className={chip(periode === k)}>{l}</button>
        ))}
      </div>
      {canSim && (
        <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={sim} onChange={(e) => set("mode", e.target.checked ? "simulasi" : null)} className="size-4 accent-matur-500" />
          Data simulasi
        </label>
      )}
    </div>
  );
}
