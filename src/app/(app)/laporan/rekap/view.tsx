"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { ChartCard, TrendChart, StatTile } from "@/components/charts";
import { SERIES } from "@/lib/chart-utils";
import {
  rekapKeuangan,
  marginLaba,
  persenLaba,
  hakLaporan,
  ringkasBayar,
  type Bayar,
} from "@/lib/laporan-rekap";
import { namaBulan, type Laporan } from "@/lib/laporan";
import { rupiahLaporan as rp } from "@/lib/laporan-rekap";
export function RekapLaporan({
  list,
  bayar,
  outlets,
  outlet,
  dari,
  sampai,
  tahun,
}: {
  list: Laporan[];
  bayar: Bayar[];
  outlets: { id: string; nama: string }[];
  outlet: string;
  dari: string;
  sampai: string;
  tahun: string;
}) {
  const rows = rekapKeuangan(list);
  const total = rows.reduce(
    (t, r) => ({
      omzet: t.omzet + r.omzet,
      laba: t.laba + r.laba,
      mitra: t.mitra + r.mitra,
      pusat: t.pusat + r.pusat,
    }),
    { omzet: 0, laba: 0, mitra: 0, pusat: 0 },
  );
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const perBulan = new Map<
    string,
    {
      label: string;
      omzet: number;
      laba: number;
      margin: number | null;
      mitra: number;
      pusat: number;
    }
  >();
  for (const r of rows) {
    const b = perBulan.get(r.periode) ?? {
      label: namaBulan(r.periode),
      omzet: 0,
      laba: 0,
      margin: null,
      mitra: 0,
      pusat: 0,
    };
    b.omzet += r.omzet;
    b.laba += r.laba;
    b.mitra += r.mitra;
    b.pusat += r.pusat;
    b.margin = marginLaba(b.laba, b.omzet);
    perBulan.set(r.periode, b);
  }
  const trend = [...perBulan.values()];
  const scope = `${outlets.find((o) => o.id === outlet)?.nama ?? "Semua outlet"} · ${dari || "awal laporan"} – ${sampai || "terakhir"}`;
  const exp = (kind: "pdf" | "excel") =>
    start(async () => {
      setError("");
      try {
        const { eksporRekap } = await import("@/lib/laporan-rekap-ekspor");
        await eksporRekap(list, bayar, scope, kind);
      } catch {
        setError("Ekspor belum berhasil. Coba lagi.");
      }
    });
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Rekap Keuangan & Bagi Hasil</h1>
        <p className="text-sm text-stone-500">
          Laporan resmi yang dapat diakses. Hak bagi hasil terpisah dari
          pembayaran aktual.
        </p>
      </div>
      <form className="flex flex-wrap items-end gap-3 rounded-2xl border bg-white p-4">
        <label className="text-sm">
          Outlet
          <select
            name="outlet"
            defaultValue={outlet}
            className="block rounded-lg border p-2"
          >
            <option value="">Semua outlet yang dapat diakses</option>
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nama}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Tahun
          <input
            name="tahun"
            onChange={(e) => {
              const f = e.currentTarget.form;
              if (f)
                for (const n of ["dari", "sampai"])
                  (f.elements.namedItem(n) as HTMLInputElement).value = "";
            }}
            type="number"
            min="2000"
            max="2200"
            defaultValue={tahun}
            className="block w-24 rounded-lg border p-2"
          />
        </label>
        <label className="text-sm">
          Dari bulan
          <input
            name="dari"
            onChange={(e) => {
              const f = e.currentTarget.form;
              if (f)
                (f.elements.namedItem("tahun") as HTMLInputElement).value = "";
            }}
            type="month"
            defaultValue={dari}
            className="block rounded-lg border p-2"
          />
        </label>
        <label className="text-sm">
          Sampai bulan
          <input
            name="sampai"
            onChange={(e) => {
              const f = e.currentTarget.form;
              if (f)
                (f.elements.namedItem("tahun") as HTMLInputElement).value = "";
            }}
            type="month"
            defaultValue={sampai}
            className="block rounded-lg border p-2"
          />
        </label>
        <button className="rounded-xl bg-kopi-900 px-4 py-2 text-white">
          Tampilkan
        </button>
        <Link href="/meeting-laporan" className="underline">
          Jadwal meeting
        </Link>
      </form>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          ["Omzet setelah diskon", rp(total.omzet)],
          ["Laba bersih outlet", rp(total.laba)],
          [
            "Margin laba bersih",
            persenLaba(marginLaba(total.laba, total.omzet)),
          ],
          ["Hak Mitra/investor", rp(total.mitra)],
          ["Hak pengelola/pusat", rp(total.pusat)],
        ].map(([label, value]) => (
          <StatTile key={label} label={label} value={value} />
        ))}
      </div>
      <p className="text-xs text-stone-500">
        Margin = laba bersih ÷ omzet setelah diskon × 100%. Total memakai jumlah
        laba ÷ jumlah omzet, bukan rata-rata persentase. Hak pembagian sesuai
        laporan periode tersebut; persentase BEP berbeda.
      </p>
      {!rows.length ? (
        <p>Belum ada laporan resmi pada pilihan ini.</p>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="Omzet dan laba bersih per bulan"
              sub={scope}
              rows={trend.map((t) => ({ ...t, margin: persenLaba(t.margin) }))}
              cols={[
                { key: "label", label: "Bulan" },
                { key: "omzet", label: "Omzet", money: true },
                { key: "laba", label: "Laba", money: true },
              ]}
            >
              <TrendChart
                data={trend}
                series={[
                  { key: "omzet", name: "Omzet", color: SERIES[0] },
                  { key: "laba", name: "Laba bersih", color: SERIES[2] },
                ]}
              />
            </ChartCard>
            <ChartCard
              title="Margin laba bersih (%)"
              sub="Persentase terhadap omzet; angka negatif menunjukkan rugi"
              rows={trend.map((t) => ({
                bulan: t.label,
                margin: persenLaba(t.margin),
              }))}
              cols={[
                { key: "bulan", label: "Bulan" },
                { key: "margin", label: "Margin" },
              ]}
            >
              <TrendChart
                data={trend}
                money={false}
                unit="%"
                series={[
                  { key: "margin", name: "Margin (%)", color: SERIES[3] },
                ]}
              />
            </ChartCard>
            <ChartCard
              title="Hak bagi hasil bulanan"
              sub="Alokasi laporan, bukan pembayaran bank"
              rows={trend.map((t) => ({ ...t, margin: persenLaba(t.margin) }))}
              cols={[
                { key: "label", label: "Bulan" },
                { key: "mitra", label: "Mitra", money: true },
                { key: "pusat", label: "Pusat", money: true },
              ]}
            >
              <TrendChart
                data={trend}
                series={[
                  { key: "mitra", name: "Mitra/investor", color: SERIES[0] },
                  { key: "pusat", name: "Pengelola/pusat", color: SERIES[1] },
                ]}
              />
            </ChartCard>
          </div>
          <section className="rounded-2xl border bg-white p-4">
            <div className="mb-3 flex flex-wrap gap-3">
              <h2 className="mr-auto font-bold">Rekap per bulan</h2>
              <button
                disabled={pending}
                onClick={() => exp("pdf")}
                className="rounded-lg border px-3 py-2"
              >
                PDF
              </button>
              <button
                disabled={pending}
                onClick={() => exp("excel")}
                className="rounded-lg border px-3 py-2"
              >
                Excel
              </button>
            </div>
            {error && <p role="alert">{error}</p>}
            <p className="mb-2 text-xs text-stone-500 sm:hidden">
              Geser tabel ke samping untuk melihat seluruh rincian.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-sm">
                <thead className="text-left">
                  <tr>
                    {[
                      "Bulan / outlet",
                      "Omzet",
                      "Laba bersih",
                      "Margin",
                      "Bagian Mitra",
                      "Bagian Pusat",
                      "Pembayaran",
                    ].map((x) => (
                      <th key={x} className="p-2">
                        {x}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const l = list.find((l) => l.id === r.id)!;
                    const hs = hakLaporan(l);
                    const bs = bayar.filter((b) => b.laporan_id === r.id);
                    const summaries = hs.map((h) => ringkasBayar(h, bs));
                    const paid = summaries.reduce((s, x) => s + x.dibayar, 0);
                    const remain = summaries.reduce((s, x) => s + x.sisa, 0);
                    return (
                      <tr key={r.id} className="border-t align-top">
                        <td className="p-2">
                          <Link
                            className="font-semibold underline"
                            href={`/laporan/${r.id}`}
                          >
                            {namaBulan(r.periode)}
                          </Link>
                          <p className="text-xs text-stone-500">{r.outlet}</p>
                        </td>
                        <td className="p-2 whitespace-nowrap">{rp(r.omzet)}</td>
                        <td
                          className={`p-2 whitespace-nowrap ${r.laba < 0 ? "text-red-700" : ""}`}
                        >
                          {rp(r.laba)}
                        </td>
                        <td className="p-2 font-semibold">
                          {persenLaba(r.margin)}
                        </td>
                        <td className="p-2">
                          {rp(r.mitra)}
                          <p className="text-xs">
                            {r.penerima
                              .filter((b) => !/pengelola|pusat/i.test(b.nama))
                              .map(
                                (b) =>
                                  `${b.nama} ${persenLaba(Number(b.persen))}`,
                              )
                              .join(" · ")}
                          </p>
                        </td>
                        <td className="p-2">
                          {rp(r.pusat)}
                          <p className="text-xs">
                            {r.penerima
                              .filter((b) => /pengelola|pusat/i.test(b.nama))
                              .map(
                                (b) =>
                                  `${b.nama} ${persenLaba(Number(b.persen))}`,
                              )
                              .join(" · ")}
                          </p>
                        </td>
                        <td className="p-2">
                          <Link
                            href={`/laporan/${r.id}/tindak-lanjut`}
                            className="font-semibold underline"
                          >
                            {paid === 0
                              ? "Belum tercatat"
                              : remain > 0
                                ? "Sebagian"
                                : "Lunas"}
                          </Link>
                          <p className="text-xs">
                            Tercatat {rp(paid)} · sisa {rp(remain)}
                          </p>
                          {summaries.some((x) => x.perluCek) && (
                            <p className="text-red-700">
                              Hak berubah, perlu diperiksa
                            </p>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-t-2 font-bold">
                    <td className="p-2">Total</td>
                    <td>{rp(total.omzet)}</td>
                    <td>{rp(total.laba)}</td>
                    <td>{persenLaba(marginLaba(total.laba, total.omzet))}</td>
                    <td>{rp(total.mitra)}</td>
                    <td>{rp(total.pusat)}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
