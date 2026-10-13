"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

export const PERIODE = [
  ["hari", "Hari ini"],
  ["7", "7 hari"],
  ["30", "30 hari"],
  ["bulan", "Bulan ini"],
  ["90", "90 hari"],
  ["12bln", "12 bulan"],
  ["kustom", "Kustom"],
] as const;

// DSB-01: pilih cabang + rentang tanggal dalam satu baris di atas grafik
export function Filters({ outlets, canSim }: { outlets: { id: string; nama: string }[] | null; canSim: boolean }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const set = (k: string, v: string | null, extra: Record<string, string | null> = {}) => {
    const q = new URLSearchParams(sp);
    for (const [kk, vv] of Object.entries({ [k]: v, ...extra })) {
      if (vv === null) q.delete(kk);
      else q.set(kk, vv);
    }
    start(() => router.push(`${path}?${q}`, { scroll: false }));
  };
  const periode = sp.get("periode") ?? "30";
  const bulanIni = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 7);
  const [dari, setDari] = useState(sp.get("dari") ?? `${Number(bulanIni.slice(0, 4)) - 1}${bulanIni.slice(4)}`);
  const [sampai, setSampai] = useState(sp.get("sampai") ?? bulanIni);
  const [buka, setBuka] = useState(periode === "kustom");
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
          <button key={k} onClick={() => (k === "kustom" ? setBuka(true) : (setBuka(false), set("periode", k === "30" ? null : k, { dari: null, sampai: null })))} className={chip(k === "kustom" ? buka : !buka && periode === k)}>
            {k === "kustom" ? "📅 Kustom" : l}
          </button>
        ))}
      </div>
      {buka && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-matur-200 bg-white px-3 py-1.5 text-sm">
          <label className="flex items-center gap-1">
            Dari
            <input type="month" value={dari} max={bulanIni} onChange={(e) => setDari(e.target.value)} className="rounded-lg border border-stone-300 px-2 py-1" />
          </label>
          <label className="flex items-center gap-1">
            sampai
            <input type="month" value={sampai} max={bulanIni} onChange={(e) => setSampai(e.target.value)} className="rounded-lg border border-stone-300 px-2 py-1" />
          </label>
          <button disabled={!dari || !sampai} onClick={() => set("periode", "kustom", { dari, sampai })} className="rounded-lg bg-kopi-700 px-3 py-1 font-semibold text-white disabled:opacity-50">
            Terapkan
          </button>
        </div>
      )}
      {canSim && (
        <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={sim} onChange={(e) => set("mode", e.target.checked ? "simulasi" : null)} className="size-4 accent-matur-500" />
          Data simulasi
        </label>
      )}
    </div>
  );
}
