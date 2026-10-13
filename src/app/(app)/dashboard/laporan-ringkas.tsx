import Link from "next/link";
import { BarList, ChartCard, StatTile, TrendChart } from "@/components/charts";
import { SERIES, rupiah } from "@/lib/chart-utils";
import { hitung, LAPORAN_COLS, type Laporan } from "@/lib/laporan";
import { supabaseServer } from "@/lib/supabase/server";

const BLN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const label = (p: string) => `${BLN[Number(p.slice(5, 7)) - 1]} ${p.slice(2, 4)}`;
const pct = (a: number, b: number) => (b ? `${(Math.round((a / b) * 1000) / 10).toString().replace(".", ",")}%` : "-");

// Kinerja outlet dari laporan keuangan bulanan yang sudah terbit (bulan yang beririsan dengan rentang filter).
export async function LaporanRingkas({ outlets, outletId, dari, sampai }: { outlets: { id: string; nama: string }[]; outletId: string | null; dari: string; sampai: string }) {
  const supabase = await supabaseServer();
  let q = supabase.from("laporan_bulanan").select(LAPORAN_COLS).eq("mode", "asli").is("deleted_at", null).gte("periode", dari.slice(0, 7) + "-01").lte("periode", sampai).order("periode");
  if (outletId) q = q.eq("outlet_id", outletId);
  const { data } = await q;
  const list = ((data ?? []) as unknown as Laporan[]).map((l) => ({ l, h: hitung(l) }));

  if (!list.length)
    return (
      <section className="rounded-2xl border border-dashed border-matur-300 bg-white px-4 py-6 text-center text-sm text-stone-500">
        Belum ada laporan keuangan terbit pada rentang ini. Coba pilih <b>12 bulan</b> atau rentang <b>Kustom</b>.
      </section>
    );

  const tot = list.reduce(
    (t, { l, h }) => ({ jual: t.jual + h.totalPenjualan, hpp: t.hpp + h.hpp, laba: t.laba + h.labaBersih, kotor: t.kotor + h.labaKotor, mitra: t.mitra + h.bagiMitra, transfer: t.transfer + h.totalTransfer, diskon: t.diskon + l.diskon }),
    { jual: 0, hpp: 0, laba: 0, kotor: 0, mitra: 0, transfer: 0, diskon: 0 },
  );
  const adaOutlet = outlets.filter((o) => list.some((x) => x.l.outlet_id === o.id));
  const multi = !outletId && adaOutlet.length > 1;
  const warna = Object.fromEntries(outlets.map((o, i) => [o.id, SERIES[i % SERIES.length]]));

  // tren per bulan: satu outlet → penjualan & laba; banyak outlet → penjualan per outlet
  const perBulan = new Map<string, Record<string, string | number>>();
  for (const { l, h } of list) {
    const row = perBulan.get(l.periode) ?? { label: label(l.periode), penjualan: 0, laba: 0 };
    row.penjualan = Number(row.penjualan) + h.totalPenjualan;
    row.laba = Number(row.laba) + h.labaBersih;
    row[l.outlet_id] = Number(row[l.outlet_id] ?? 0) + h.totalPenjualan;
    perBulan.set(l.periode, row);
  }
  const tren = [...perBulan.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v);

  const jumlahkan = (pick: (l: Laporan) => { nama: string; jumlah: number }[]) => {
    const m = new Map<string, number>();
    for (const { l } of list) for (const b of pick(l)) m.set(b.nama, (m.get(b.nama) ?? 0) + Number(b.jumlah || 0));
    return [...m.entries()].map(([name, value]) => ({ name, value })).filter((x) => x.value > 0).sort((a, b) => b.value - a.value);
  };
  const kanal = jumlahkan((l) => l.pendapatan).map((k) => ({ ...k, name: /^pendapatan lain/i.test(k.name) ? "Pendapatan lain-lain" : k.name }));
  const beban = jumlahkan((l) => l.beban).slice(0, 8);
  const bagi = jumlahkan((l) => l.bagi_hasil);
  const terakhir = list[list.length - 1];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="mr-auto text-lg font-bold">Kinerja outlet dari laporan keuangan</h2>
        <p className="text-xs text-stone-500">
          {list.length} laporan · {label(list[0].l.periode)} – {label(terakhir.l.periode)} ·{" "}
          <Link href="/laporan" className="text-matur-700 underline">lihat laporan</Link>
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile label="Total penjualan" value={rupiah(tot.jual)} sub={`rata-rata ${rupiah(tot.jual / perBulan.size)}/bulan`} />
        <StatTile label="Laba kotor" value={rupiah(tot.kotor)} sub={`margin ${pct(tot.kotor, tot.jual)}`} />
        <StatTile label="Laba bersih" value={rupiah(tot.laba)} sub={`margin ${pct(tot.laba, tot.jual)}`} tone={tot.laba < 0 ? "warn" : undefined} />
        <StatTile label="HPP bahan baku" value={rupiah(tot.hpp)} sub={`${pct(tot.hpp, tot.jual)} dari penjualan`} />
        <StatTile label="Bagi hasil mitra/investor" value={rupiah(tot.mitra)} sub={`total transfer ${rupiah(tot.transfer)}`} />
      </div>

      <ChartCard
        title="Tren bulanan"
        sub={multi ? "Penjualan per outlet" : "Penjualan dan laba bersih"}
        rows={tren.map((t): Record<string, string | number> => (multi ? { Bulan: t.label, ...Object.fromEntries(adaOutlet.map((o) => [o.nama, Number(t[o.id] ?? 0)])) } : { Bulan: t.label, Penjualan: t.penjualan, "Laba bersih": t.laba }))}
        cols={multi ? [{ key: "Bulan", label: "Bulan" }, ...adaOutlet.map((o) => ({ key: o.nama, label: o.nama, money: true }))] : [{ key: "Bulan", label: "Bulan" }, { key: "Penjualan", label: "Penjualan", money: true }, { key: "Laba bersih", label: "Laba bersih", money: true }]}
      >
        <TrendChart
          data={tren}
          series={multi ? adaOutlet.map((o) => ({ key: o.id, name: o.nama, color: warna[o.id] })) : [{ key: "penjualan", name: "Penjualan", color: SERIES[0] }, { key: "laba", name: "Laba bersih", color: SERIES[3] }]}
        />
      </ChartCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Komposisi pendapatan" sub="Per kanal, total rentang" rows={kanal.map((k) => ({ Kanal: k.name, Nilai: k.value }))} cols={[{ key: "Kanal", label: "Kanal" }, { key: "Nilai", label: "Nilai", money: true }]}>
          <BarList data={kanal} colors={kanal.map(() => SERIES[0])} />
        </ChartCard>
        <ChartCard title="Beban operasional terbesar" sub="Total rentang" rows={beban.map((k) => ({ Beban: k.name, Nilai: k.value }))} cols={[{ key: "Beban", label: "Beban" }, { key: "Nilai", label: "Nilai", money: true }]}>
          <BarList data={beban} />
        </ChartCard>
        {bagi.length > 0 && (
          <ChartCard title="Bagi hasil" sub="Akumulasi pembagian laba bersih" rows={bagi.map((k) => ({ Penerima: k.name, Nilai: k.value }))} cols={[{ key: "Penerima", label: "Penerima" }, { key: "Nilai", label: "Nilai", money: true }]}>
            <BarList data={bagi} colors={bagi.map(() => SERIES[3])} />
          </ChartCard>
        )}
      </div>
    </section>
  );
}
