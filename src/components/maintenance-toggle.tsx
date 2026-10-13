"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { aturMaintenance } from "@/lib/maintenance-actions";

// Saklar mode maintenance di dashboard owner/admin pusat.
export function MaintenanceToggle({ aktif, pesan }: { aktif: boolean; pesan: string | null }) {
  const [teks, setTeks] = useState(pesan ?? "");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const ubah = (v: boolean) =>
    (!v || confirm("Nyalakan maintenance? Semua pengguna selain owner & admin pusat akan melihat layar maintenance.")) &&
    start(async () => {
      const r = await aturMaintenance(v, teks);
      setErr(r.error ?? "");
    });
  return (
    <section className={`flex flex-wrap items-center gap-3 rounded-2xl border-2 p-3 ${aktif ? "border-amber-400 bg-amber-50" : "border-matur-200 bg-white"}`}>
      <Image src="/mascot/maintenance.png" alt="" width={96} height={64} className="h-16 w-auto" />
      <div className="min-w-48 flex-1">
        <p className="font-bold">Mode maintenance {aktif ? <span className="text-amber-700">· AKTIF</span> : <span className="text-stone-500">· mati</span>}</p>
        <input value={teks} onChange={(e) => setTeks(e.target.value)} placeholder="Pesan untuk pengguna (opsional), mis. selesai pukul 14.00" className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-1.5 text-sm" />
        {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
      </div>
      <button disabled={pending} onClick={() => ubah(!aktif)} className={`rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${aktif ? "bg-green-600" : "bg-amber-600"}`}>
        {pending ? "…" : aktif ? "Matikan maintenance" : "Nyalakan maintenance"}
      </button>
    </section>
  );
}
