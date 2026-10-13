"use client";

import { useMemo, useState } from "react";
import { ChartCard, TrendChart } from "@/components/charts";
import { SERIES } from "@/lib/chart-utils";
import { formatRupiah } from "@/lib/format";
import { simulasikan, type InputSimulasi } from "@/lib/simulasi";

export type Acuan = { nama: string; bulan: number; omzet: number; hpp: number; beban: number };
type Skema = { id: string; nama: string; sedekah: number; mitra: number };

const nf = (n: number) => new Intl.NumberFormat("id-ID").format(Math.round(n));
const angka = (v: string) => Number(v.replace(/\./g, "").replace(",", ".")) || 0;

export function SimulasiView({ skema, acuan }: { skema: Skema[]; acuan: Acuan[] }) {
  const awal = skema.find((k) => /55/.test(k.nama)) ?? skema[0];
  const a0 = acuan[0];
  const [x, setX] = useState<InputSimulasi>({
    investasi: 135_000_000,
    omzet: a0?.omzet ?? 60_000_000,
    tumbuh: 0,
    hpp: a0?.hpp ?? 40,
    beban: a0?.beban ?? 15_000_000,
    sedekah: awal?.sedekah ?? 2.5,
    mitra: awal?.mitra ?? 55,
    bulan: 36,
  });
  const [skemaId, setSkemaId] = useState(awal?.id ?? "kustom");
  // teks mentah kolom persen agar koma desimal tidak hilang saat mengetik
  const [teks, setTeks] = useState<Partial<Record<keyof InputSimulasi, string>>>({});
  const r = useMemo(() => simulasikan(x), [x]);
  const set = (k: keyof InputSimulasi, v: number) => setX({ ...x, [k]: v });
  const uang = (k: keyof InputSimulasi, label: string, sub?: string) => (
    <label className="text-xs text-stone-600">
      {label}
      <input inputMode="numeric" value={x[k] ? nf(x[k]) : ""} onChange={(e) => set(k, angka(e.target.value))} className="mt-0.5 w-full rounded-lg border border-stone-300 px-2 py-2 text-right text-sm text-stone-900" />
      {sub && <span className="text-[11px] text-stone-400">{sub}</span>}
    </label>
  );
  const persen = (k: keyof InputSimulasi, label: string) => (
    <label className="text-xs text-stone-600">
      {label}
      <input inputMode="decimal" value={teks[k] ?? String(x[k]).replace(".", ",")} onChange={(e) => (setTeks({ ...teks, [k]: e.target.value }), set(k, angka(e.target.value)))} onBlur={() => setTeks({ ...teks, [k]: undefined })} className="mt-0.5 w-full rounded-lg border border-stone-300 px-2 py-2 text-right text-sm text-stone-900" />
    </label>
  );
  const tren = r.baris.map((b) => ({ label: `Bln ${b.ke}`, akumMitra: Math.round(b.akumMitra), investasi: x.investasi }));
  const bulanTeks = (n: number | null) => (n === null ? `belum BEP dalam ${x.bulan} bulan` : `bulan ke-${n} (± ${Math.floor(n / 12) ? `${Math.floor(n / 12)} th ` : ""}${n % 12 ? `${n % 12} bln` : ""})`);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Simulasi Kemitraan</h1>
        <p className="text-sm text-stone-500">Hitung perkiraan bagi hasil dan BEP untuk calon mitra. Rumus mengikuti format laporan Ruma: laba bersih = (penjualan − HPP) − sedekah − beban operasional, lalu dibagi sesuai skema.</p>
      </div>

      <section className="space-y-3 rounded-2xl border border-matur-200 bg-white p-4">
        {acuan.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-stone-500">Isi dari outlet berjalan:</span>
            {acuan.map((a) => (
              <button key={a.nama} onClick={() => setX({ ...x, omzet: a.omzet, hpp: a.hpp, beban: a.beban })} className="rounded-full border border-matur-300 px-3 py-1 font-semibold text-matur-700 hover:bg-matur-50">
                {a.nama} <span className="font-normal text-stone-500">(rata-rata {a.bulan} bln)</span>
              </button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {uang("investasi", "Investasi awal mitra (Rp)")}
          {uang("omzet", "Penjualan per bulan (Rp)")}
          {persen("tumbuh", "Pertumbuhan penjualan / bulan (%)")}
          {persen("hpp", "HPP bahan baku (% penjualan)")}
          {uang("beban", "Beban operasional / bulan (Rp)", "gaji, listrik, air, sewa, dll.")}
          <label className="text-xs text-stone-600">
            Skema bagi hasil
            <select
              value={skemaId}
              onChange={(e) => {
                setSkemaId(e.target.value);
                const k = skema.find((s) => s.id === e.target.value);
                if (k) (setX({ ...x, mitra: k.mitra, sedekah: k.sedekah }), setTeks({}));
              }}
              className="mt-0.5 w-full rounded-lg border border-stone-300 px-2 py-2 text-sm text-stone-900"
            >
              {skema.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.nama} (mitra {k.mitra}%)
                </option>
              ))}
              <option value="kustom">Kustom…</option>
            </select>
          </label>
          {persen("mitra", "Bagian mitra (% laba bersih)")}
          {persen("sedekah", "Sedekah (% laba kotor)")}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {[
          ["Laba bersih outlet / bulan", formatRupiah(r.labaBulan1), r.labaBulan1 < 0 ? "rugi — cek asumsi" : "bulan pertama"],
          ["Bagian mitra / bulan", formatRupiah(r.mitraBulan1), `${x.mitra}% dari laba bersih`],
          ["BEP mitra", r.bepMitra ? `Bulan ke-${r.bepMitra}` : "—", r.bepMitra ? "akumulasi bagian mitra ≥ investasi" : bulanTeks(null)],
          ["ROI mitra tahun pertama", `${r.roiTahunan.toFixed(1).replace(".", ",")}%`, "bagian mitra 12 bln ÷ investasi"],
        ].map(([k, v, sub]) => (
          <div key={k} className="rounded-2xl border border-matur-200 bg-white p-3">
            <p className="text-xs text-stone-500">{k}</p>
            <p className="text-lg font-bold tabular-nums">{v}</p>
            <p className="text-[11px] text-stone-500">{sub}</p>
          </div>
        ))}
      </section>

      <ChartCard
        title="Akumulasi bagian mitra vs investasi"
        sub={`Proyeksi ${x.bulan} bulan · BEP outlet (laba bersih kumulatif ≥ investasi): ${bulanTeks(r.bepOutlet)}`}
        rows={r.baris.map((b) => ({ Bulan: b.ke, Penjualan: Math.round(b.penjualan), "Laba bersih": Math.round(b.labaBersih), "Bagian mitra": Math.round(b.bagianMitra), "Akumulasi mitra": Math.round(b.akumMitra) }))}
        cols={[
          { key: "Bulan", label: "Bulan" },
          { key: "Penjualan", label: "Penjualan", money: true },
          { key: "Laba bersih", label: "Laba bersih", money: true },
          { key: "Bagian mitra", label: "Bagian mitra", money: true },
          { key: "Akumulasi mitra", label: "Akumulasi mitra", money: true },
        ]}
      >
        <TrendChart
          data={tren}
          series={[
            { key: "akumMitra", name: "Akumulasi bagian mitra", color: SERIES[2] },
            { key: "investasi", name: "Investasi awal", color: SERIES[1] },
          ]}
        />
      </ChartCard>
      <p className="text-xs text-stone-400">Simulasi memakai asumsi tetap; hasil nyata bergantung penjualan, harga bahan, dan biaya setiap bulan. Tidak mengubah data apa pun.</p>
    </div>
  );
}
