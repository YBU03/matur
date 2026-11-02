"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { aturVoidPin } from "@/lib/void-actions";

export type OutletVoid = { id: string; nama: string; void_wajib_pin: boolean };

/** Pengaturan pembatalan (void) per outlet. */
export function VoidPinPanel({ outlets }: { outlets: OutletVoid[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ error?: string; ok?: string } | null>(null);
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-matur-100 bg-white p-4 text-sm text-stone-600 shadow-sm">
        <p className="font-semibold text-kopi-900">🚫 Pembatalan transaksi (void) di POS</p>
        <p className="mt-1">
          <b>Mati (bawaan)</b>: kasir/barista membatalkan langsung dari Riwayat POS dengan alasan, catatan, dan nama wajib diisi. SPV, HRD, dan Owner mendapat notifikasi.{" "}
          <b>Aktif</b>: void wajib PIN SPV di tablet. Semua void tercatat di{" "}
          <Link href="/laporan-pos/void" className="font-semibold text-matur-700 underline">Laporan Void</Link> dan{" "}
          <Link href="/laporan-pos/void_orang" className="font-semibold text-matur-700 underline">Rekap Void per Orang</Link>.
        </p>
      </div>
      {msg && <p role="status" className={`rounded-xl px-3 py-2 text-sm ${msg.error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-800"}`}>{msg.error ?? msg.ok}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {outlets.map((o) => (
          <div key={o.id} className="flex items-center gap-3 rounded-2xl border border-matur-100 bg-white p-4 shadow-sm">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-kopi-900">{o.nama}</p>
              <p className={`text-xs font-semibold ${o.void_wajib_pin ? "text-amber-700" : "text-emerald-700"}`}>
                {o.void_wajib_pin ? "🔒 Void wajib PIN SPV" : "⚡ Void langsung + alasan wajib"}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={o.void_wajib_pin}
              aria-label={`Void wajib PIN SPV di ${o.nama}`}
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await aturVoidPin(o.id, !o.void_wajib_pin);
                  setMsg(r);
                  if (!r.error) router.refresh();
                })
              }
              className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50 ${o.void_wajib_pin ? "bg-amber-500" : "bg-stone-300"}`}
            >
              <span className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-all ${o.void_wajib_pin ? "left-[22px]" : "left-0.5"}`} />
            </button>
          </div>
        ))}
        {!outlets.length && <p className="text-sm text-stone-500">Belum ada outlet.</p>}
      </div>
    </div>
  );
}
