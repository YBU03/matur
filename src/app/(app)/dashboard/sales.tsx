import { BarList, ChartCard, Heatmap, StatTile, TrendChart } from "@/components/charts";
import { SERIES, rupiah } from "@/lib/chart-utils";
import { supabaseServer } from "@/lib/supabase/server";
import { Filters } from "./filters";

type Ringkasan = {
  kpi: { omzet: number; trx: number; hpp: number; diskon: number };
  harian: { tgl: string; outlet_id: string; omzet: number; trx: number }[];
  kanal: { kanal: string; omzet: number; trx: number }[];
  jam: { dow: number; jam: number; trx: number }[];
  menu: { nama: string; qty: number; omzet: number }[];
  outlet: { outlet_id: string; nama: string; omzet: number; trx: number; hpp: number }[];
  shift_terbuka: number;
};

const KANAL: Record<string, string> = {
  langsung: "Langsung", gofood: "GoFood", grabfood: "GrabFood", shopeefood: "ShopeeFood", tiktok: "TikTok Go", ruma_app: "Ruma App", tumbler: "Tumbler",
};
const BLN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

const iso = (d: Date) => d.toISOString().slice(0, 10);
function jakartaToday() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }).replace(/,.*/, "") + " UTC");
}
export function rentang(periode: string) {
  const t = jakartaToday();
  const back = (n: number) => new Date(t.getTime() - n * 86400000);
  const dari =
    periode === "hari" ? t : periode === "7" ? back(6) : periode === "90" ? back(89) : periode === "12bln" ? back(364) : periode === "bulan" ? new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1)) : back(29);
  const hari = Math.round((t.getTime() - dari.getTime()) / 86400000) + 1;
  // periode sebelumnya dengan panjang sama, untuk perbandingan
  return { dari: iso(dari), sampai: iso(t), hari, prevDari: iso(new Date(dari.getTime() - hari * 86400000)), prevSampai: iso(new Date(dari.getTime() - 86400000)) };
}

function bucket(tgl: string, hari: number) {
  const d = new Date(tgl + "T00:00:00Z");
  if (hari <= 31) return { key: tgl, label: `${d.getUTCDate()} ${BLN[d.getUTCMonth()]}` };
  if (hari <= 120) {
    const senin = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86400000);
    return { key: iso(senin), label: `${senin.getUTCDate()} ${BLN[senin.getUTCMonth()]}` };
  }
  return { key: tgl.slice(0, 7), label: `${BLN[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}` };
}

const delta = (now: number, prev: number) => (prev ? `${now >= prev ? "▲" : "▼"} ${Math.abs(Math.round(((now - prev) / prev) * 100))}% vs periode sebelumnya` : undefined);

export async function SalesDashboard({
  outlets,
  outletId,
  periode,
  mode,
  canPick,
  canSim,
}: {
  outlets: { id: string; nama: string }[];
  outletId: string | null;
  periode: string;
  mode: "asli" | "simulasi";
  canPick: boolean;
  canSim: boolean;
}) {
  const r = rentang(periode);
  const supabase = await supabaseServer();
  const [{ data: now }, { data: prev }] = await Promise.all([
    supabase.rpc("ringkasan_penjualan", { p_outlet: outletId, p_dari: r.dari, p_sampai: r.sampai, p_mode: mode }),
    supabase.rpc("ringkasan_penjualan", { p_outlet: outletId, p_dari: r.prevDari, p_sampai: r.prevSampai, p_mode: mode }),
  ]);
  const d = now as Ringkasan | null;
  const p = prev as Ringkasan | null;
  const k = d?.kpi ?? { omzet: 0, trx: 0, hpp: 0, diskon: 0 };

  // warna tetap per outlet (urutan nama), tidak berubah saat difilter
  const color = Object.fromEntries(outlets.map((o, i) => [o.id, SERIES[i % SERIES.length]]));
  const nama = Object.fromEntries(outlets.map((o) => [o.id, o.nama]));
  const shown = outletId ? outlets.filter((o) => o.id === outletId) : outlets.filter((o) => d?.harian.some((h) => h.outlet_id === o.id));

  const buckets = new Map<string, Record<string, string | number>>();
  for (const h of d?.harian ?? []) {
    const b = bucket(h.tgl, r.hari);
    const row = buckets.get(b.key) ?? { label: b.label };
    row[h.outlet_id] = Number(row[h.outlet_id] ?? 0) + h.omzet;
    buckets.set(b.key, row);
  }
  const trend = [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v);
  const satuan = r.hari <= 31 ? "harian" : r.hari <= 120 ? "mingguan" : "bulanan";

  const menu = d?.menu ?? [];
  const kanal = (d?.kanal ?? []).map((x) => ({ name: KANAL[x.kanal] ?? x.kanal, value: x.omzet, trx: x.trx }));
  const cabang = (d?.outlet ?? []).map((o) => ({ name: o.nama, value: o.omzet, id: o.outlet_id, trx: o.trx }));

  return (
    <section className="space-y-4">
      {mode === "simulasi" && (
        <div className="rounded-xl bg-[repeating-linear-gradient(45deg,#fde68a_0_12px,#fef3c7_12px_24px)] px-4 py-2 text-center text-sm font-bold tracking-wide text-amber-900">
          MODE SIMULASI — data latihan, bukan data asli
        </div>
      )}
      <Filters outlets={canPick ? outlets : null} canSim={canSim} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile label="Omzet" value={rupiah(k.omzet)} sub={delta(k.omzet, p?.kpi.omzet ?? 0)} />
        <StatTile label="Jumlah transaksi" value={k.trx.toLocaleString("id-ID")} sub={delta(k.trx, p?.kpi.trx ?? 0)} />
        <StatTile label="Rata-rata per struk" value={rupiah(k.trx ? k.omzet / k.trx : 0)} />
        <StatTile label="Laba kotor (teoritis)" value={rupiah(k.omzet - k.hpp)} sub="omzet − HPP resep" />
        <StatTile label="Food cost" value={k.omzet ? `${Math.round((k.hpp / k.omzet) * 1000) / 10}%` : "-"} sub="HPP teoritis ÷ omzet" />
      </div>
      {(d?.shift_terbuka ?? 0) > 0 && mode === "asli" && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">⚠️ {d!.shift_terbuka} shift kasir belum ditutup.</p>
      )}

      <ChartCard
        title="Tren omzet"
        sub={`Omzet ${satuan}${shown.length > 1 ? " per outlet" : ""}`}
        rows={trend.map((t) => ({ Periode: t.label, ...Object.fromEntries(shown.map((o) => [o.nama, Number(t[o.id] ?? 0)])) }))}
        cols={[{ key: "Periode", label: "Periode" }, ...shown.map((o) => ({ key: o.nama, label: o.nama, money: true }))]}
      >
        <TrendChart data={trend} series={shown.map((o) => ({ key: o.id, name: nama[o.id], color: color[o.id] }))} />
      </ChartCard>

      <div className="grid gap-4 lg:grid-cols-2">
        {!outletId && cabang.length > 1 && (
          <ChartCard title="Perbandingan cabang" sub="Omzet per outlet" rows={cabang.map((c) => ({ Outlet: c.name, Omzet: c.value, Transaksi: c.trx }))} cols={[{ key: "Outlet", label: "Outlet" }, { key: "Omzet", label: "Omzet", money: true }, { key: "Transaksi", label: "Transaksi" }]}>
            <BarList data={cabang} colors={cabang.map((c) => color[c.id] ?? SERIES[0])} />
          </ChartCard>
        )}
        <ChartCard title="Komposisi kanal penjualan" sub="Omzet per kanal" rows={kanal.map((c) => ({ Kanal: c.name, Omzet: c.value, Transaksi: c.trx }))} cols={[{ key: "Kanal", label: "Kanal" }, { key: "Omzet", label: "Omzet", money: true }, { key: "Transaksi", label: "Transaksi" }]}>
          <BarList data={kanal} />
        </ChartCard>
        <ChartCard title="Menu terlaris" sub="10 teratas berdasarkan jumlah terjual" rows={menu.slice(0, 10).map((m) => ({ Menu: m.nama, Terjual: m.qty, Omzet: m.omzet }))} cols={[{ key: "Menu", label: "Menu" }, { key: "Terjual", label: "Terjual" }, { key: "Omzet", label: "Omzet", money: true }]}>
          <BarList data={menu.slice(0, 10).map((m) => ({ name: m.nama, value: m.qty }))} money={false} unit=" cup" />
        </ChartCard>
        <ChartCard title="Menu kurang laku" sub="5 terbawah berdasarkan jumlah terjual" rows={menu.slice(-5).reverse().map((m) => ({ Menu: m.nama, Terjual: m.qty, Omzet: m.omzet }))} cols={[{ key: "Menu", label: "Menu" }, { key: "Terjual", label: "Terjual" }, { key: "Omzet", label: "Omzet", money: true }]}>
          <BarList data={menu.slice(-5).reverse().map((m) => ({ name: m.nama, value: m.qty }))} money={false} unit=" cup" max={menu[0]?.qty} />
        </ChartCard>
      </div>

      <ChartCard title="Jam ramai" sub="Jumlah transaksi per hari dan jam" rows={(d?.jam ?? []).map((c) => ({ Hari: ["", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"][c.dow], Jam: `${c.jam}.00`, Transaksi: c.trx }))} cols={[{ key: "Hari", label: "Hari" }, { key: "Jam", label: "Jam" }, { key: "Transaksi", label: "Transaksi" }]}>
        <Heatmap cells={d?.jam ?? []} />
      </ChartCard>
    </section>
  );
}
