"use client";

import { useMemo, useState } from "react";
import { ChartCard, TrendChart } from "@/components/charts";
import { SERIES } from "@/lib/chart-utils";
import { formatRupiah } from "@/lib/format";
import { simulasikan, type InputSimulasi } from "@/lib/simulasi";

import { geserBulan, hitungAcuanBulanan, type AcuanBulanan, type OutletAcuan } from "@/lib/simulasi-acuan";
type Skema = { id: string; nama: string; sedekah: number; mitra: number };

const nf = (n: number) => new Intl.NumberFormat("id-ID").format(Math.round(n));
const angka = (v: string) => Number(v.replace(/\./g, "").replace(",", ".")) || 0;

export function SimulasiView({ skema, acuan, outlets, bulanIni }: { skema: Skema[]; acuan: AcuanBulanan[]; outlets: OutletAcuan[]; bulanIni: string }) {
  const awal = skema.find((k) => /55/.test(k.nama)) ?? skema[0];
  const [outletId, setOutletId] = useState(outlets[0]?.id ?? "semua");
  const [mode, setMode] = useState("tiga");
  const [bulan, setBulan] = useState(acuan[0]?.periode ?? bulanIni);
  const [dari, setDari] = useState(geserBulan(acuan[0]?.periode ?? bulanIni, -2));
  const [sampai, setSampai] = useState(acuan[0]?.periode ?? bulanIni);
  const [sumber, setSumber] = useState("");
  const bulanTersedia = useMemo(() => [...new Set(acuan.filter(a => outletId === "semua" || a.outletId === outletId).map(a => a.periode))].sort().reverse(), [acuan, outletId]);
  const bulanPilihan = bulanTersedia.includes(bulan) ? bulan : bulanTersedia[0] ?? "";
  const bulanDari = bulanTersedia.includes(dari) ? dari : bulanTersedia.at(-1) ?? "";
  const bulanSampai = bulanTersedia.includes(sampai) ? sampai : bulanTersedia[0] ?? "";
  const opsiBulan = bulanTersedia.length ? bulanTersedia.map(b => <option key={b} value={b}>{new Date(`${b}-01T00:00:00Z`).toLocaleDateString("id-ID", { timeZone: "UTC", month: "long", year: "numeric" })}</option>) : <option value="">Belum ada bulan laporan</option>;
  const awalPeriode = mode === "satu" ? bulanPilihan : mode === "tiga" ? geserBulan(bulanPilihan, -2) : bulanDari;
  const akhirPeriode = mode === "kustom" ? bulanSampai : bulanPilihan;
  const hasilAcuan = useMemo(() => hitungAcuanBulanan(acuan, outlets, { outletId, dari: awalPeriode, sampai: akhirPeriode }), [acuan, outlets, outletId, awalPeriode, akhirPeriode]);
  const [x, setX] = useState<InputSimulasi>({
    investasi: 135_000_000,
    omzet: 60_000_000,
    tumbuh: 0,
    hpp: 40,
    beban: 15_000_000,
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
        <div className="space-y-3 rounded-2xl border border-matur-200 bg-gradient-to-br from-matur-50 via-amber-50 to-white p-4 shadow-sm">
          <div className="flex items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-matur-100 text-xl">📊</span><div><h2 className="font-bold text-kopi-900">Isi dari outlet berjalan</h2><p className="text-xs text-stone-500">Pilih outlet dan bulan laporan yang sudah tersedia</p></div></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs text-stone-600">Outlet
              <select aria-label="Outlet" value={outletId} onChange={e => setOutletId(e.target.value)} className="mt-1 w-full rounded-lg border border-matur-200 bg-white p-2 text-sm">
                <option value="semua">Semua Outlet</option>
                {outlets.map(o => <option key={o.id} value={o.id}>{o.nama}</option>)}
              </select>
            </label>
            <label className="text-xs text-stone-600">Periode acuan
              <select aria-label="Periode acuan" value={mode} onChange={e => setMode(e.target.value)} className="mt-1 w-full rounded-lg border border-matur-200 bg-white p-2 text-sm">
                <option value="satu">Satu bulan</option><option value="tiga">3 bulan sampai bulan pilihan</option><option value="kustom">Kustom rentang bulan</option>
              </select>
            </label>
            {mode === "kustom" ? <>
              <label className="text-xs text-stone-600">Bulan awal<select aria-label="Bulan awal" value={bulanDari} disabled={!bulanTersedia.length} onChange={e => setDari(e.target.value)} className="mt-1 min-w-0 w-full rounded-lg border border-matur-200 bg-white p-2 text-sm shadow-sm focus:ring-2 focus:ring-matur-300">{opsiBulan}</select></label>
              <label className="text-xs text-stone-600">Bulan akhir<select aria-label="Bulan akhir" value={bulanSampai} disabled={!bulanTersedia.length} onChange={e => setSampai(e.target.value)} className="mt-1 min-w-0 w-full rounded-lg border border-matur-200 bg-white p-2 text-sm shadow-sm focus:ring-2 focus:ring-matur-300">{opsiBulan}</select></label>
            </> : <label className="text-xs text-stone-600">{mode === "satu" ? "Bulan" : "Sampai bulan"}<select aria-label="Bulan acuan" value={bulanPilihan} disabled={!bulanTersedia.length} onChange={e => setBulan(e.target.value)} className="mt-1 min-w-0 w-full rounded-lg border border-matur-200 bg-white p-2 text-sm shadow-sm focus:ring-2 focus:ring-matur-300">{opsiBulan}</select></label>}
          </div>
          <p className="text-xs text-stone-600">Acuan memakai laporan keuangan bulanan yang tersedia. Semua Outlet dihitung rata-rata per outlet per bulan, bukan gabungan omzet seluruh outlet. Bulan tanpa laporan tidak dianggap nol.</p>
          {hasilAcuan.error ? <p role="status" className="text-sm text-amber-800">{hasilAcuan.error}</p> : <div className="space-y-1 text-sm">
            <p>{hasilAcuan.jumlah} laporan · {hasilAcuan.outlet} outlet · {awalPeriode} s.d. {akhirPeriode}</p>
            <p>Penjualan {formatRupiah(hasilAcuan.omzet)} / bulan · HPP {hasilAcuan.hpp}% · Beban {formatRupiah(hasilAcuan.beban)} / bulan</p>
            {!!hasilAcuan.kosong && <p className="text-xs text-amber-800">{hasilAcuan.kosong} kombinasi outlet-bulan belum memiliki laporan; tidak disertakan dalam rata-rata.</p>}
          </div>}
          <button type="button" disabled={!!hasilAcuan.error} onClick={() => {
            if (hasilAcuan.error || hasilAcuan.omzet === undefined) return;
            setX(v => ({ ...v, omzet: hasilAcuan.omzet, hpp: hasilAcuan.hpp, beban: hasilAcuan.beban }));
            setTeks(v => ({ ...v, hpp: undefined }));
            setSumber(`${outletId === "semua" ? "Semua Outlet" : outlets.find(o => o.id === outletId)?.nama} · ${awalPeriode} s.d. ${akhirPeriode} · ${hasilAcuan.jumlah} laporan`);
          }} className="rounded-lg bg-kopi-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">Gunakan sebagai acuan</button>
          {sumber && <p role="status" className="text-xs text-emerald-800">Acuan terakhir diterapkan: {sumber}. Asumsi di bawah tetap dapat diedit manual.</p>}
        </div>
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
