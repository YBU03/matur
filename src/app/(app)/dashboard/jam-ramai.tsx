"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Clock3 } from "lucide-react";
import { ChartCard, Heatmap } from "@/components/charts";
import { jamDalamPekan, pekanTanggal, type DataJamTanggal } from "@/lib/jam-penjualan";

const tanggal = (tgl: string, opsi: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("id-ID", { timeZone: "UTC", ...opsi }).format(new Date(`${tgl}T00:00:00Z`));
const waktu = (jam: number) => `${String(jam).padStart(2, "0")}.00`;

export function JamRamai({ data, dari, sampai, error }: {
  data: DataJamTanggal | null; dari: string; sampai: string; error?: boolean;
}) {
  const pekan = pekanTanggal(dari, sampai);
  const [pilihan, setPilihan] = useState(0);
  const index = Math.min(pilihan, pekan.length - 1);
  const aktif = pekan[index];
  if (!aktif) return null;
  const geser = (arah: number) => setPilihan(Math.max(0, Math.min(pekan.length - 1, index + arah)));
  const cells = jamDalamPekan(data?.cells ?? [], aktif);
  const perJam = new Map<number, number>();
  for (const c of cells) perJam.set(c.jam, (perJam.get(c.jam) ?? 0) + c.trx);
  const top = [...perJam].sort((a, b) => b[1] - a[1])[0];
  const rentang = `${tanggal(aktif.dari, { day: "numeric", month: "short" })} – ${tanggal(aktif.sampai, { day: "numeric", month: "short", year: "numeric" })}`;
  const rows = cells.map(c => ({ Tanggal: tanggal(c.tgl, { weekday: "short", day: "numeric", month: "short", year: "numeric" }), Jam: `${waktu(c.jam)}–${waktu((c.jam + 1) % 24)}`, Transaksi: c.trx }));
  // Tujuh tanggal memiliki hari yang unik. Urutan tampilan lama tetap Minggu–Sabtu.
  const hari = aktif.tanggal.map(tgl => {
    const day = new Date(`${tgl}T00:00:00Z`).getUTCDay();
    return { dow: day || 7, urut: day, label: tanggal(tgl, { weekday: "short" }), tanggal: tanggal(tgl, { day: "numeric", month: "short" }) };
  }).sort((a, b) => a.urut - b.urut);
  const heat = cells.map(c => ({ dow: new Date(`${c.tgl}T00:00:00Z`).getUTCDay() || 7, jam: c.jam, trx: c.trx }));
  const toolbar = (
    <div className="mb-3 flex items-center gap-2 rounded-xl border border-matur-200 bg-matur-50 p-2">
      <button type="button" aria-label="Rentang tanggal sebelumnya" disabled={index <= 0} onClick={() => geser(-1)} className="grid size-10 shrink-0 place-items-center rounded-lg border border-matur-200 bg-white text-kopi-900 focus-visible:outline-2 focus-visible:outline-matur-600 disabled:opacity-30"><ChevronLeft size={20} /></button>
      <div className="min-w-0 flex-1 text-center" aria-live="polite">
        <p className="text-sm font-bold text-kopi-900">{rentang}</p>
        <p className="text-xs text-stone-500">Rentang {index + 1} dari {pekan.length} · Gunakan panah untuk pindah periode</p>
      </div>
      <button type="button" aria-label="Rentang tanggal berikutnya" disabled={index >= pekan.length - 1} onClick={() => geser(1)} className="grid size-10 shrink-0 place-items-center rounded-lg border border-matur-200 bg-white text-kopi-900 focus-visible:outline-2 focus-visible:outline-matur-600 disabled:opacity-30"><ChevronRight size={20} /></button>
    </div>
  );
  return (
    <ChartCard title="Jam ramai" sub={`Transaksi per tanggal dan jam WIB · ${rentang}`} rows={rows} toolbar={toolbar} showEmptyContent
      cols={[{ key: "Tanggal", label: "Tanggal" }, { key: "Jam", label: "Jam" }, { key: "Transaksi", label: "Transaksi" }]}>
      {error || !data ? <p role="status" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Data jam transaksi belum dapat dimuat. Coba muat ulang halaman.</p> : (
        <>
          <p className="mb-3 flex items-center gap-2 text-xs text-stone-600"><Clock3 size={15} className="shrink-0" />{top ? `Jam tersibuk pada rentang ini: ${waktu(top[0])}–${waktu((top[0] + 1) % 24)} WIB · ${top[1]} transaksi` : "Belum ada data penjualan dengan jam transaksi pada rentang ini."}</p>
          <Heatmap key={`${aktif.dari}:${aktif.sampai}`} cells={heat} hari={hari} scrollJam />
          {data.tanpa_jam > 0 && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">{data.tanpa_jam} catatan historis pada periode pilihan tidak memiliki rincian waktu transaksi sehingga tidak dimasukkan ke grafik jam.</p>}
        </>
      )}
    </ChartCard>
  );
}
