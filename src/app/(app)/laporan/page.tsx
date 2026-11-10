import { AksesLaporanMitra } from "@/components/akses-laporan-mitra";
import type { PeriodeLaporan } from "@/lib/laporan-internal";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ImporRuma } from "@/components/impor-ruma";
import { ImporLaporanPdf } from "@/components/impor-laporan-pdf";
import { ChartCard, TrendChart } from "@/components/charts";
import { SERIES } from "@/lib/chart-utils";
import { formatRupiah } from "@/lib/format";
import { hitung, LAPORAN_COLS, namaBulan, type Laporan } from "@/lib/laporan";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

const BOLEH = ["owner", "admin_pusat", "finance", "manajer_area", "mitra"];

// Daftar laporan keuangan bulanan per outlet (data tiap outlet terpisah)
export default async function DaftarLaporan({
  searchParams,
}: {
  searchParams: Promise<{ outlet?: string }>;
}) {
  const s = await getSession();
  if (!s?.active || !BOLEH.includes(s.active.role)) notFound();
  const supabase = await supabaseServer();
  const [{ data: outlets }, { data: rows }] = await Promise.all([
    supabase
      .from("outlet")
      .select("id, nama, skema:skema_bagi_hasil(nama)")
      .eq("mode", "asli")
      .is("deleted_at", null)
      .order("tgl_mulai"),
    supabase
      .from("laporan_bulanan")
      .select(LAPORAN_COLS)
      .eq("mode", "asli")
      .is("deleted_at", null)
      .order("periode", { ascending: false }),
  ]);
  const semua = (rows ?? []) as unknown as Laporan[];
  const daftar = outlets ?? [];
  const pilih =
    (await searchParams).outlet ??
    daftar.find((o) => semua.some((l) => l.outlet_id === o.id))?.id ??
    daftar[0]?.id;
  const role = s.active.role;
  const internal = ["owner", "admin_pusat", "finance"].includes(s.active.role);
  const { data: periodeData, error: periodeError } = pilih
    ? await supabase.rpc("periode_laporan", { p_outlet: pilih })
    : { data: [], error: null };
  if (periodeError) throw new Error("Gagal membaca periode laporan.");
  const periodeList = (periodeData ?? []) as PeriodeLaporan[];
  const list = semua.filter((l) => l.outlet_id === pilih);
  const ringkas = list.map((l) => ({ l, h: hitung(l) }));
  const total = ringkas.reduce(
    (t, { h }) => ({
      omzet: t.omzet + h.totalPenjualan,
      laba: t.laba + h.labaBersih,
      mitra: t.mitra + h.bagiMitra,
    }),
    { omzet: 0, laba: 0, mitra: 0 },
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-2xl font-bold">Laporan Keuangan</h1>
        {["owner", "admin_pusat", "finance"].includes(s.active.role) &&
          pilih && (
            <ImporRuma
              outlets={daftar.map((o) => ({ id: o.id, nama: o.nama }))}
              outletId={pilih}
              label="⬆ Impor laporan (Excel)"
            />
          )}
        {["owner", "admin_pusat", "finance"].includes(s.active.role) && pilih && (
          <ImporLaporanPdf outlets={daftar.map((o) => ({ id: o.id, nama: o.nama }))} outletId={pilih} />
        )}
        {["owner", "admin_pusat", "finance"].includes(s.active.role) && (
          <Link
            href={`/laporan/proyeksi${pilih ? `?outlet=${pilih}` : ""}`}
            className="rounded-xl bg-matur-500 px-4 py-2 text-sm font-semibold text-white"
          >
            📊 Buka laporan bulan berjalan
          </Link>
        )}
      </div>
      {internal && pilih && (
        <div className="flex flex-wrap gap-2 text-sm">
          <Link
            className="rounded-xl border border-matur-300 bg-white px-4 py-2 font-semibold text-matur-700"
            href={`/laporan/proyeksi?outlet=${pilih}&sumber=manual`}
          >
            ＋ Buat laporan manual
          </Link>
          <p className="w-full text-stone-600">
            Laporan internal dapat diperiksa harian. Mitra hanya mendapat versi
            resmi setelah disetujui dan jadwal bukanya tercapai.
          </p>
        </div>
      )}
      <div className="-mx-4 overflow-x-auto px-4">
        <div className="flex w-max gap-2">
          {daftar.length > 1 &&
            daftar.map((o) => {
              const n = semua.filter((l) => l.outlet_id === o.id).length;
              return (
                <Link
                  key={o.id}
                  href={`/laporan?outlet=${o.id}`}
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${o.id === pilih ? "bg-kopi-900 text-white" : "border border-matur-200 bg-white text-kopi-700"}`}
                >
                  {o.nama} <span className="opacity-70">({n})</span>
                </Link>
              );
            })}
        </div>
      </div>

      {s.active.role !== "mitra" &&
        (() => {
          const sk = (
            daftar.find((o) => o.id === pilih)?.skema as unknown as {
              nama: string;
            } | null
          )?.nama;
          return (
            <p className="text-sm text-stone-500">
              Skema bagi hasil:{" "}
              <b className="text-kopi-900">{sk ?? "belum dipilih"}</b> ·{" "}
              <Link
                href="/skema-bagi-hasil"
                className="text-matur-700 underline"
              >
                atur
              </Link>
            </p>
          );
        })()}

      <div className="space-y-3">
        {periodeList.map((p) =>
          role === "mitra" ? (
            <AksesLaporanMitra key={p.periode} periode={p} />
          ) : (
            <section
              key={p.periode}
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-matur-200 bg-white p-4"
            >
              <div className="min-w-0 flex-1">
                <h2 className="font-bold">{namaBulan(p.periode)}</h2>
                <p className="text-xs text-stone-600">
                  {p.ada_draft ? "Draft Internal" : "Berjalan"} · {p.sumber} ·{" "}
                  {p.terbuka
                    ? "Terbit ke Mitra"
                    : p.disetujui
                      ? "Disetujui · menunggu jadwal"
                      : "Belum terbit ke Mitra"}
                </p>
              </div>
              {internal && (
                <Link
                  href={`/laporan/proyeksi?outlet=${pilih}&bulan=${p.periode.slice(0, 7)}`}
                  className="rounded-lg bg-matur-700 px-3 py-2 text-sm font-semibold text-white"
                >
                  Periksa Internal →
                </Link>
              )}
              {internal && p.ada_draft && (
                <Link
                  href={`/laporan/internal?outlet=${pilih}&bulan=${p.periode.slice(0, 7)}`}
                  className="rounded-lg border border-matur-300 px-3 py-2 text-sm font-semibold text-matur-700"
                >
                  Preview tersimpan
                </Link>
              )}
              {p.laporan_id && (
                <Link
                  href={`/laporan/${p.laporan_id}`}
                  className="text-sm font-semibold text-matur-700 underline"
                >
                  Versi resmi
                </Link>
              )}
            </section>
          ),
        )}
      </div>
      {list.length === 0 || s.active.role === "mitra" ? null : (
        <>
          <section className="grid grid-cols-3 gap-2 sm:gap-3">
            {[
              ["Total penjualan", total.omzet],
              ["Total laba bersih", total.laba],
              ["Bagi hasil mitra", total.mitra],
            ].map(([k, v]) => (
              <div
                key={k}
                className="rounded-2xl border border-matur-200 bg-white p-3"
              >
                <p className="text-xs text-stone-500">{k}</p>
                <p className="text-sm font-bold sm:text-lg">
                  {formatRupiah(Number(v))}
                </p>
                <p className="text-[11px] text-stone-400">
                  {list.length} bulan
                </p>
              </div>
            ))}
          </section>
          {ringkas.length > 1 &&
            (() => {
              const tren = [...ringkas].reverse().map(({ l, h }) => ({
                label: new Date(l.periode + "T00:00:00").toLocaleDateString(
                  "id-ID",
                  { month: "short", year: "2-digit" },
                ),
                penjualan: h.totalPenjualan,
                laba: h.labaBersih,
              }));
              return (
                <ChartCard
                  title="Tren penjualan & laba bersih"
                  sub="Per bulan laporan terbit"
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
              );
            })()}
        </>
      )}
    </div>
  );
}
