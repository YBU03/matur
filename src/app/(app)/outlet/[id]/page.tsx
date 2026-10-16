import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChartCard, TrendChart } from "@/components/charts";
import { SERIES } from "@/lib/chart-utils";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { hitung, LAPORAN_COLS, namaBulan, type Laporan } from "@/lib/laporan";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

type Janji = {
  id: string;
  persen_mitra: number;
  persen_pengelola: number;
  sewa_bulanan: number | null;
  modal_outlet: number | null;
  investasi_awal: number | null;
  bank: string | null;
  no_rekening: string | null;
  atas_nama: string | null;
  mitra: { nama: string; no_hp: string | null; email: string | null } | null;
};

const PUSAT = ["owner", "admin_pusat", "finance", "manajer_area"];
const hariIni = () =>
  new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

// Info outlet dari menu Outlet: profil, mitra & perjanjian, progres BEP, omzet POS, proyek pembangunan, tim.
export default async function InfoOutlet({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const s = await getSession();
  if (!s?.active || !PUSAT.includes(s.active.role)) notFound();
  const supabase = await supabaseServer();
  const hari = hariIni();
  const awalBulan = hari.slice(0, 8) + "01";
  const [
    { data: o },
    { data: pj },
    { data: rows },
    { data: proyek },
    { data: bulan },
    { data: today },
    { count: tim },
  ] = await Promise.all([
    supabase
      .from("outlet")
      .select(
        "id, nama, kota, alamat, status, kepemilikan, tgl_mulai, jam_operasional, spv:pengguna!outlet_spv_id_fkey(nama)",
      )
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("perjanjian")
      .select(
        "id, persen_mitra, persen_pengelola, sewa_bulanan, modal_outlet, investasi_awal, bank, no_rekening, atas_nama, mitra(nama, no_hp, email)",
      )
      .eq("outlet_id", id)
      .eq("mode", "asli")
      .is("deleted_at", null),
    supabase
      .from("laporan_bulanan")
      .select(LAPORAN_COLS)
      .eq("outlet_id", id)
      .eq("mode", "asli")
      .is("deleted_at", null)
      .order("periode"),
    supabase
      .from("proyek")
      .select("id, nama, status, target_buka, selesai_at")
      .eq("outlet_id", id)
      .is("deleted_at", null),
    supabase.rpc("ringkasan_penjualan", {
      p_outlet: id,
      p_dari: awalBulan,
      p_sampai: hari,
      p_mode: "asli",
    }),
    supabase.rpc("ringkasan_penjualan", {
      p_outlet: id,
      p_dari: hari,
      p_sampai: hari,
      p_mode: "asli",
    }),
    supabase
      .from("karyawan")
      .select("id", { count: "exact", head: true })
      .eq("outlet_id", id)
      .eq("mode", "asli")
      .is("deleted_at", null),
  ]);
  if (!o) notFound();
  const janji = (pj ?? []) as unknown as Janji[];
  const investasi = janji.reduce(
    (t, j) => t + Number(j.investasi_awal || 0),
    0,
  );
  const laporan = (rows ?? []) as unknown as Laporan[];
  let akum = 0;
  const tren = laporan.map((l) => {
    akum += hitung(l).labaBersih;
    return {
      label: namaBulan(l.periode),
      laba: hitung(l).labaBersih,
      akumulasi: akum,
    };
  });
  const rata = laporan.length ? akum / laporan.length : 0;
  const persen = investasi ? Math.min((akum / investasi) * 100, 100) : 0;
  const sisa = Math.max(investasi - akum, 0);
  const bulanLagi = rata > 0 ? Math.ceil(sisa / rata) : null;
  const kpiBulan = (bulan as { kpi?: { omzet: number; trx: number } } | null)
    ?.kpi;
  const kpiHari = (today as { kpi?: { omzet: number; trx: number } } | null)
    ?.kpi;
  const spv = (o.spv as unknown as { nama: string } | null)?.nama;
  const warnaStatus =
    o.status === "operasional"
      ? "bg-green-100 text-green-800"
      : o.status === "pembangunan"
        ? "bg-amber-100 text-amber-800"
        : "bg-stone-100 text-stone-600";

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Link
        href="/master/outlet"
        className="text-sm font-semibold text-matur-700"
      >
        ← Semua outlet
      </Link>
      <section className="flex flex-wrap items-center gap-4 rounded-3xl bg-gradient-to-r from-matur-400 to-matur-600 p-5 text-white">
        <Image
          src="/brand/outlet.png"
          alt=""
          width={80}
          height={80}
          className="rounded-2xl bg-white/20 p-1"
        />
        <div className="mr-auto min-w-0">
          <h1 className="text-2xl font-bold">{o.nama}</h1>
          <p className="text-sm text-white/90">
            {[o.kota, o.kepemilikan, o.jam_operasional]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {o.alamat && <p className="text-xs text-white/80">{o.alamat}</p>}
          <p className="mt-1 text-xs text-white/80">
            {o.tgl_mulai
              ? `Beroperasi sejak ${formatTanggal(o.tgl_mulai)}`
              : "Belum beroperasi"}
            {spv ? ` · SPV: ${spv}` : ""} · {tim ?? 0} karyawan
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm font-bold ${warnaStatus}`}
        >
          {o.status}
        </span>
      </section>

      <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {[
          [
            "Omzet hari ini",
            formatRupiah(kpiHari?.omzet ?? 0),
            `${kpiHari?.trx ?? 0} transaksi`,
          ],
          [
            "Omzet bulan ini",
            formatRupiah(kpiBulan?.omzet ?? 0),
            `${kpiBulan?.trx ?? 0} transaksi`,
          ],
          [
            "Investasi awal",
            formatRupiah(investasi),
            janji.length
              ? `${janji.length} perjanjian`
              : "belum ada perjanjian",
          ],
          [
            "Progres BEP",
            investasi ? `${persen.toFixed(1).replace(".", ",")}%` : "-",
            sisa === 0 && investasi
              ? "Sudah BEP 🎉"
              : bulanLagi
                ? `± ${bulanLagi} bulan lagi`
                : "menunggu laporan",
          ],
        ].map(([k, v, c]) => (
          <div
            key={k}
            className="rounded-2xl border border-matur-200 bg-white p-3"
          >
            <p className="text-xs text-stone-500">{k}</p>
            <p className="text-lg font-bold tabular-nums">{v}</p>
            <p className="text-xs text-stone-400">{c}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-matur-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-bold">🤝 Mitra & perjanjian</h2>
          <Link
            href="/master/perjanjian"
            className="text-xs font-semibold text-matur-700"
          >
            Kelola perjanjian ›
          </Link>
        </div>
        {!janji.length ? (
          <p className="text-sm text-stone-400">
            {o.kepemilikan?.toLowerCase() === "pusat"
              ? "Outlet milik pusat (tanpa mitra)."
              : "Belum ada perjanjian mitra untuk outlet ini."}
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {janji.map((j) => (
              <div key={j.id} className="rounded-xl bg-matur-50 p-3 text-sm">
                <p className="text-base font-bold">{j.mitra?.nama ?? "-"}</p>
                <p className="text-xs text-stone-600">
                  {[j.mitra?.no_hp, j.mitra?.email]
                    .filter(Boolean)
                    .join(" · ") || "Kontak belum diisi"}
                </p>
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                  <dt className="text-stone-500">Bagi hasil</dt>
                  <dd>
                    Mitra {Number(j.persen_mitra)}% · Pengelola{" "}
                    {Number(j.persen_pengelola)}%
                  </dd>
                  <dt className="text-stone-500">Investasi</dt>
                  <dd>{formatRupiah(Number(j.investasi_awal || 0))}</dd>
                  {!!j.sewa_bulanan && (
                    <>
                      <dt className="text-stone-500">Sewa/bulan</dt>
                      <dd>{formatRupiah(Number(j.sewa_bulanan))}</dd>
                    </>
                  )}
                  {j.no_rekening && (
                    <>
                      <dt className="text-stone-500">Rekening</dt>
                      <dd>
                        {j.bank} {j.no_rekening} a.n. {j.atas_nama}
                      </dd>
                    </>
                  )}
                </dl>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-matur-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-bold">📈 Progres BEP</h2>
          <Link
            href={`/portal/bep?outlet=${o.id}`}
            className="text-xs font-semibold text-matur-700"
          >
            Detail & penerimaan mitra ›
          </Link>
        </div>
        {!investasi ? (
          <p className="text-sm text-stone-400">
            Investasi awal belum diisi di Perjanjian Mitra.
          </p>
        ) : (
          <>
            <div
              className="h-4 overflow-hidden rounded-full bg-stone-100"
              role="img"
              aria-label={`BEP ${persen.toFixed(1)}%`}
            >
              <div
                className="h-full rounded-full"
                style={{ width: `${persen}%`, background: SERIES[2] }}
              />
            </div>
            <p className="mt-1 text-sm">
              <b>{persen.toFixed(1).replace(".", ",")}%</b> kembali ·{" "}
              {formatRupiah(akum)} dari {formatRupiah(investasi)} · rata-rata{" "}
              {formatRupiah(Math.round(rata))}/bulan
            </p>
            {tren.length > 0 ? (
              <div className="mt-3">
                <ChartCard
                  title="Akumulasi laba bersih"
                  sub={`${tren.length} laporan bulanan terbit`}
                  rows={tren}
                  cols={[
                    { key: "label", label: "Bulan" },
                    { key: "laba", label: "Laba bulan itu", money: true },
                    { key: "akumulasi", label: "Akumulasi", money: true },
                  ]}
                >
                  <TrendChart
                    data={tren}
                    series={[
                      { key: "akumulasi", name: "Akumulasi", color: SERIES[2] },
                      { key: "laba", name: "Laba bulan itu", color: SERIES[0] },
                    ]}
                  />
                </ChartCard>
              </div>
            ) : (
              <p className="mt-2 text-xs text-stone-400">
                Belum ada laporan bulanan terbit untuk outlet ini.
              </p>
            )}
          </>
        )}
      </section>

      {(proyek ?? []).length > 0 && (
        <section className="rounded-2xl border border-matur-200 bg-white p-4">
          <h2 className="mb-2 font-bold">🏗️ Proyek pembangunan</h2>
          <ul className="space-y-1 text-sm">
            {(proyek ?? []).map((p) => (
              <li key={p.id}>
                <Link
                  href={`/proyek/${p.id}`}
                  className="flex justify-between gap-2 rounded-lg px-2 py-1 hover:bg-matur-50"
                >
                  <span className="font-semibold">{p.nama}</span>
                  <span
                    className={
                      p.status === "selesai"
                        ? "text-green-700"
                        : "text-amber-700"
                    }
                  >
                    {p.status === "selesai"
                      ? `Selesai${p.selesai_at ? ` ${formatTanggal(String(p.selesai_at).slice(0, 10))}` : ""} ✓`
                      : p.target_buka
                        ? `Target buka ${formatTanggal(p.target_buka)}`
                        : "Sedang berjalan"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
