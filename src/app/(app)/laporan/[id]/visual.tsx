"use client";

// Ringkasan visual laporan bulanan: KPI + perbandingan bulan lalu, struktur penjualan, komposisi, tren.
// Warna kategori mengikuti urutan tetap tervalidasi (SERIES); teks selalu memakai tinta netral.
import { BarList, ChartCard, TrendChart } from "@/components/charts";
import { SERIES, rupiah } from "@/lib/chart-utils";

export type Ringkas = { periode: string; label: string; penjualan: number; hpp: number; laba_kotor: number; beban: number; laba_bersih: number };
export type Visual = {
  bulan: string;
  penjualan: number;
  hpp: number;
  labaKotor: number;
  beban: number;
  sedekah: number;
  labaBersih: number;
  pendapatan: { name: string; value: number }[];
  bebanRinci: { name: string; value: number }[];
  bagiHasil: { name: string; value: number }[];
  prev: Ringkas | null;
  riwayat: Ringkas[];
};

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);

function Delta({ now, prev }: { now: number; prev?: number }) {
  if (prev === undefined || !prev) return <p className="text-xs text-stone-400">belum ada pembanding</p>;
  const d = pct(now - prev, Math.abs(prev));
  const naik = d >= 0;
  return (
    <p className={`text-xs font-semibold ${naik ? "text-green-700" : "text-red-600"}`}>
      {naik ? "▲" : "▼"} {Math.abs(d).toString().replace(".", ",")}% <span className="font-normal text-stone-500">vs bulan lalu</span>
    </p>
  );
}

export function LaporanVisual({ v }: { v: Visual }) {
  const bagian = [
    { name: "HPP (bahan baku)", value: v.hpp, color: SERIES[0] },
    { name: "Beban operasional", value: v.beban, color: SERIES[1] },
    { name: "Sedekah", value: v.sedekah, color: SERIES[2] },
    { name: "Laba bersih", value: Math.max(v.labaBersih, 0), color: SERIES[3] },
  ];
  const total = bagian.reduce((s, b) => s + b.value, 0) || 1;
  const kpi = [
    { k: "Total penjualan", now: v.penjualan, prev: v.prev?.penjualan },
    { k: "Laba kotor", now: v.labaKotor, prev: v.prev?.laba_kotor, sub: `margin ${pct(v.labaKotor, v.penjualan).toString().replace(".", ",")}%` },
    { k: "Laba bersih", now: v.labaBersih, prev: v.prev?.laba_bersih, sub: `margin ${pct(v.labaBersih, v.penjualan).toString().replace(".", ",")}%` },
    { k: "HPP", now: v.hpp, sub: `${pct(v.hpp, v.penjualan).toString().replace(".", ",")}% dari penjualan` },
  ];
  const tren = v.riwayat.map((r) => ({ label: r.label, penjualan: r.penjualan, laba: r.laba_bersih }));

  return (
    <div className="space-y-3">
      <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {kpi.map((x) => (
          <div key={x.k} className="rounded-2xl border border-matur-200 bg-white p-3">
            <p className="text-xs text-stone-500">{x.k}</p>
            <p className="text-lg font-bold tabular-nums">{rupiah(x.now)}</p>
            {x.prev !== undefined ? <Delta now={x.now} prev={x.prev} /> : <p className="text-xs text-stone-500">{x.sub}</p>}
            {x.prev !== undefined && x.sub && <p className="text-[11px] text-stone-400">{x.sub}</p>}
          </div>
        ))}
      </section>

      {v.prev && <Perbandingan v={v} />}

      <ChartCard
        title="Ke mana uang penjualan pergi"
        sub={`Dari setiap Rp100 penjualan ${v.bulan}`}
        rows={bagian.map((b) => ({ bagian: b.name, nilai: b.value, persen: `${pct(b.value, total)}%` }))}
        cols={[
          { key: "bagian", label: "Bagian" },
          { key: "nilai", label: "Nilai", money: true },
          { key: "persen", label: "Porsi" },
        ]}
      >
        <div className="flex h-9 w-full gap-[2px] overflow-hidden rounded-lg" role="img" aria-label="Struktur penjualan">
          {bagian
            .filter((b) => b.value > 0)
            .map((b) => (
              <div key={b.name} title={`${b.name}: ${rupiah(b.value)} (${pct(b.value, total)}%)`} style={{ width: `${(b.value / total) * 100}%`, background: b.color }} className="first:rounded-l-lg last:rounded-r-lg" />
            ))}
        </div>
        <ul className="mt-3 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
          {bagian.map((b) => (
            <li key={b.name} className="flex items-center gap-2">
              <span className="size-3 shrink-0 rounded-sm" style={{ background: b.color }} />
              <span className="flex-1 text-stone-700">{b.name}</span>
              <b className="tabular-nums">{pct(b.value, total).toString().replace(".", ",")}%</b>
              <span className="w-28 text-right text-xs tabular-nums text-stone-500">{rupiah(b.value)}</span>
            </li>
          ))}
        </ul>
      </ChartCard>

      {tren.length > 1 && (
        <ChartCard
          title="Tren bulanan"
          sub="Penjualan dan laba bersih per bulan"
          rows={tren}
          cols={[
            { key: "label", label: "Bulan" },
            { key: "penjualan", label: "Penjualan", money: true },
            { key: "laba", label: "Laba bersih", money: true },
          ]}
        >
          <TrendChart
            data={tren}
            series={[
              { key: "penjualan", name: "Penjualan", color: SERIES[0] },
              { key: "laba", name: "Laba bersih", color: SERIES[3] },
            ]}
          />
        </ChartCard>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <ChartCard title="Komposisi pendapatan" sub="Per kanal penjualan" rows={v.pendapatan.map((p) => ({ kanal: p.name, nilai: p.value }))} cols={[{ key: "kanal", label: "Kanal" }, { key: "nilai", label: "Nilai", money: true }]}>
          <BarList data={v.pendapatan} colors={v.pendapatan.map(() => SERIES[0])} />
        </ChartCard>
        <ChartCard title="Beban operasional terbesar" sub="Termasuk sedekah" rows={v.bebanRinci.map((p) => ({ beban: p.name, nilai: p.value }))} cols={[{ key: "beban", label: "Beban" }, { key: "nilai", label: "Nilai", money: true }]}>
          <BarList data={v.bebanRinci} />
        </ChartCard>
      </div>

      {v.bagiHasil.length > 0 && (
        <ChartCard title="Bagi hasil" sub="Pembagian laba bersih" rows={v.bagiHasil.map((p) => ({ penerima: p.name, nilai: p.value }))} cols={[{ key: "penerima", label: "Penerima" }, { key: "nilai", label: "Nilai", money: true }]}>
          <BarList data={v.bagiHasil} colors={v.bagiHasil.map(() => SERIES[3])} />
        </ChartCard>
      )}
    </div>
  );
}

/** Tabel bulan ini vs bulan lalu; perubahan memakai panah + teks (bukan warna saja). */
export function barisBanding(v: Visual) {
  const p = v.prev!;
  return [
    { k: "Total penjualan", lalu: p.penjualan, kini: v.penjualan, naikBaik: true },
    { k: "HPP (bahan baku)", lalu: p.hpp, kini: v.hpp, naikBaik: false },
    { k: "Laba kotor", lalu: p.laba_kotor, kini: v.labaKotor, naikBaik: true },
    { k: "Beban operasional + sedekah", lalu: p.beban, kini: v.beban + v.sedekah, naikBaik: false },
    { k: "Laba bersih", lalu: p.laba_bersih, kini: v.labaBersih, naikBaik: true },
  ];
}

function Perbandingan({ v }: { v: Visual }) {
  const rows = barisBanding(v);
  return (
    <section className="rounded-2xl border border-matur-200 bg-white p-4">
      <h3 className="font-semibold">Perbandingan dengan bulan lalu</h3>
      <p className="mb-2 text-xs text-stone-500">
        {v.prev!.label} → {v.bulan}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-stone-500">
            <tr>
              <th className="py-1">Pos</th>
              <th className="text-right">Bulan lalu</th>
              <th className="text-right">Bulan ini</th>
              <th className="text-right">Perubahan</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const d = r.lalu ? ((r.kini - r.lalu) / Math.abs(r.lalu)) * 100 : 0;
              const baik = d === 0 ? null : (d > 0) === r.naikBaik;
              return (
                <tr key={r.k} className="border-t">
                  <td className="py-1.5">{r.k}</td>
                  <td className="text-right tabular-nums text-stone-500">{rupiah(r.lalu)}</td>
                  <td className="text-right font-semibold tabular-nums">{rupiah(r.kini)}</td>
                  <td className={`whitespace-nowrap text-right text-xs font-semibold ${baik === null ? "text-stone-500" : baik ? "text-green-700" : "text-red-600"}`}>
                    {d > 0 ? "▲" : d < 0 ? "▼" : "="} {Math.abs(d).toFixed(1).replace(".", ",")}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
