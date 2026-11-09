"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Clock3 } from "lucide-react";
import { ChartCard } from "@/components/charts";
import { jamDalamPekan, pekanTanggal, type DataJamTanggal } from "@/lib/jam-penjualan";

const tanggal = (tgl: string, opsi: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("id-ID", { timeZone: "UTC", ...opsi }).format(new Date(`${tgl}T00:00:00Z`));
const waktu = (jam: number) => `${String(jam).padStart(2, "0")}.00`;
const warna = ["#fff5cc", "#fcd34d", "#fb923c", "#c45d3e", "#773c68"];

export function JamRamai({ data, dari, sampai, error }: {
  data: DataJamTanggal | null; dari: string; sampai: string; error?: boolean;
}) {
  const pekan = pekanTanggal(dari, sampai);
  const [pilihan, setPilihan] = useState(Math.max(0, pekan.length - 1));
  const [detail, setDetail] = useState("");
  const sentuh = useRef<{ x: number; y: number } | null>(null);
  const index = Math.min(pilihan, pekan.length - 1);
  const aktif = pekan[index];
  if (!aktif) return null;
  const geser = (arah: number) => {
    setPilihan(Math.max(0, Math.min(pekan.length - 1, index + arah)));
    setDetail("");
  };
  const cells = jamDalamPekan(data?.cells ?? [], aktif);
  const utama = Array.from({ length: 21 }, (_, i) => (i + 6) % 24);
  const jamList = [...new Set([...utama, ...cells.map(c => c.jam)])].sort((a, b) => (a + 18) % 24 - (b + 18) % 24);
  const map = new Map(cells.map(c => [`${c.tgl}:${c.jam}`, c.trx]));
  const max = Math.max(1, ...cells.map(c => c.trx));
  const perJam = new Map<number, number>();
  for (const c of cells) perJam.set(c.jam, (perJam.get(c.jam) ?? 0) + c.trx);
  const top = [...perJam].sort((a, b) => b[1] - a[1])[0];
  const rentang = `${tanggal(aktif.dari, { day: "numeric", month: "short" })} – ${tanggal(aktif.sampai, { day: "numeric", month: "short", year: "numeric" })}`;
  const rows = cells.map(c => ({ Tanggal: tanggal(c.tgl, { weekday: "short", day: "numeric", month: "short", year: "numeric" }), Jam: `${waktu(c.jam)}–${waktu((c.jam + 1) % 24)}`, Transaksi: c.trx }));
  return (
    <ChartCard title="Jam ramai" sub={`Transaksi per tanggal dan jam WIB · ${rentang}`} rows={rows}
      cols={[{ key: "Tanggal", label: "Tanggal" }, { key: "Jam", label: "Jam" }, { key: "Transaksi", label: "Transaksi" }]}>
      <div className="mb-3 flex items-center gap-2 rounded-xl border border-matur-200 bg-matur-50 p-2">
        <button type="button" aria-label="Rentang tanggal sebelumnya" disabled={index <= 0} onClick={() => geser(-1)} className="grid size-10 shrink-0 place-items-center rounded-lg border border-matur-200 bg-white text-kopi-900 focus-visible:outline-2 focus-visible:outline-matur-600 disabled:opacity-30"><ChevronLeft size={20} /></button>
        <div className="min-w-0 flex-1 text-center" aria-live="polite">
          <p className="text-sm font-bold text-kopi-900">{rentang}</p>
          <p className="text-xs text-stone-500">Rentang {index + 1} dari {pekan.length} · Geser kiri atau kanan</p>
        </div>
        <button type="button" aria-label="Rentang tanggal berikutnya" disabled={index >= pekan.length - 1} onClick={() => geser(1)} className="grid size-10 shrink-0 place-items-center rounded-lg border border-matur-200 bg-white text-kopi-900 focus-visible:outline-2 focus-visible:outline-matur-600 disabled:opacity-30"><ChevronRight size={20} /></button>
      </div>
      {error || !data ? <p role="status" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Data jam transaksi belum dapat dimuat. Coba muat ulang halaman.</p> : (
        <>
          <p className="mb-3 flex items-center gap-2 text-xs text-stone-600"><Clock3 size={15} className="shrink-0" />{top ? `Jam tersibuk pada rentang ini: ${waktu(top[0])}–${waktu((top[0] + 1) % 24)} WIB · ${top[1]} transaksi` : "Belum ada data penjualan dengan jam transaksi pada rentang ini."}</p>
          <div style={{ touchAction: "pan-y" }} onTouchStart={e => { sentuh.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }} onTouchCancel={() => { sentuh.current = null; }} onTouchEnd={e => {
            const awal = sentuh.current; sentuh.current = null;
            if (!awal || !e.changedTouches.length) return;
            const dx = e.changedTouches[0].clientX - awal.x;
            if (Math.abs(dx) > 50 && Math.abs(e.changedTouches[0].clientY - awal.y) < 40) geser(dx < 0 ? 1 : -1);
          }}>
            <div className="grid gap-1" style={{ gridTemplateColumns: `34px repeat(${aktif.tanggal.length}, minmax(0, 1fr))` }}>
              <span className="self-center text-[10px] text-stone-500">WIB</span>
              {aktif.tanggal.map(tgl => <div key={tgl} className="min-w-0 rounded-lg bg-matur-50 py-1 text-center"><span className="block text-[10px] text-stone-500">{tanggal(tgl, { weekday: "short" })}</span><span className="text-xs font-bold text-kopi-900">{Number(tgl.slice(8))}</span></div>)}
              {jamList.flatMap(jam => [
                <span key={`j${jam}`} className="self-center text-[10px] tabular-nums text-stone-500">{waktu(jam)}</span>,
                ...aktif.tanggal.map(tgl => {
                  const n = map.get(`${tgl}:${jam}`) ?? 0;
                  const label = `${tanggal(tgl, { weekday: "long", day: "numeric", month: "long" })} · ${waktu(jam)}–${waktu((jam + 1) % 24)} WIB · ${n} transaksi`;
                  return <button key={`${tgl}:${jam}`} type="button" aria-label={label} title={label} onFocus={() => setDetail(label)} onMouseEnter={() => setDetail(label)} onClick={() => setDetail(label)} className="h-6 min-w-0 rounded-md text-[10px] font-semibold tabular-nums focus-visible:outline-2 focus-visible:outline-kopi-900" style={{ background: n ? warna[Math.min(4, Math.floor(n / max * 5))] : "#f5f5f4", color: n / max >= 0.6 ? "white" : "#78350f" }}>{n || ""}</button>;
                }),
              ])}
            </div>
          </div>
          <p role="status" className="mt-2 min-h-8 text-xs text-stone-600">{detail || "Ketuk kotak untuk melihat rincian transaksi. Jam 00–02 mengikuti tanggal operasional outlet."}</p>
          <div className="flex items-center justify-end gap-1 text-[10px] text-stone-500">Sepi {warna.map(c => <span key={c} className="h-2.5 w-4 rounded-sm" style={{ background: c }} />)} Ramai</div>
          {data.tanpa_jam > 0 && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">{data.tanpa_jam} catatan historis pada periode pilihan tidak memiliki rincian waktu transaksi sehingga tidak dimasukkan ke grafik jam.</p>}
        </>
      )}
    </ChartCard>
  );
}
