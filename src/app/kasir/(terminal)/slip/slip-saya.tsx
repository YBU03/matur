"use client";

import { useState } from "react";
import { namaBulan, type SlipPdf } from "@/app/(app)/penggajian/slip-pdf";
import { formatRupiah } from "@/lib/format";
import type { Kop } from "@/lib/pdf-kop";

export type SlipStaf = SlipPdf & { id: string };

export function SlipSaya({ slips, perusahaan }: { slips: SlipStaf[]; perusahaan: Kop }) {
  const [buka, setBuka] = useState(slips[0]?.id ?? "");
  const pdf = async (x: SlipStaf) => {
    const { unduhSlip } = await import("@/app/(app)/penggajian/slip-pdf");
    await unduhSlip(perusahaan, [x], `Slip gaji ${x.nama} ${x.bulan}`);
  };
  return (
    <div className="mx-auto max-w-lg space-y-3">
      <h1 className="text-xl font-bold">Slip Gaji Saya</h1>
      {slips.length === 0 && <p className="rounded-2xl border border-matur-200 bg-white p-6 text-center text-sm text-stone-500">Belum ada slip gaji. Slip muncul setelah HRD memfinalkan gaji bulanan.</p>}
      {slips.map((x) => (
        <div key={x.id} className="rounded-2xl border border-matur-200 bg-white p-4">
          <button onClick={() => setBuka(buka === x.id ? "" : x.id)} className="flex w-full items-center justify-between text-left">
            <span className="font-semibold">{namaBulan(x.bulan)}</span>
            <b className="tabular-nums">{formatRupiah(x.total)}</b>
          </button>
          {buka === x.id && (
            <div className="mt-2 space-y-1 border-t pt-2 text-sm">
              <p className="text-xs text-stone-500">
                {x.outlet} · {x.hadir} hadir · {x.telat}× telat · {x.izin} izin · {x.tidak_absen} tidak absen
              </p>
              {[
                ["Pendapatan", x.pendapatan],
                ["Potongan", x.potongan],
              ].map(([j, xs]) => (
                <div key={String(j)}>
                  <p className="mt-1 text-xs font-semibold text-stone-500">{String(j)}</p>
                  {(xs as SlipPdf["pendapatan"]).map((b, i) => (
                    <p key={i} className="flex justify-between">
                      <span>{b.nama}</span>
                      <span className="tabular-nums">{formatRupiah(b.jumlah)}</span>
                    </p>
                  ))}
                </div>
              ))}
              <p className="flex justify-between border-t pt-1 font-bold">
                <span>Gaji diterima</span>
                <span>{formatRupiah(x.total)}</span>
              </p>
              <button onClick={() => pdf(x)} className="mt-2 w-full rounded-xl border border-matur-300 py-2 font-semibold text-matur-700">
                ⬇ Unduh slip PDF
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
