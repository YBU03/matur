import Link from "next/link";
import { notFound } from "next/navigation";
import { ChartCard, TrendChart } from "@/components/charts";
import { PilihOutlet } from "@/components/pilih-outlet";
import { ChipHeader, HeaderHalaman, Kartu, tabel } from "@/components/ui-halaman";
import { SERIES } from "@/lib/chart-utils";
import { formatRupiah } from "@/lib/format";
import { namaBulan } from "@/lib/laporan";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

const BOLEH = ["owner", "admin_pusat", "finance", "admin_gudang", "hrd", "manajer_area", "spv"];
type P = {
  periode: string;
  laporan_id: string | null;
  awal: number | null;
  sumber_awal: string;
  pembelian: number;
  kiriman_gudang: number;
  pembelian_rincian: Record<string, number>;
  tagihan_titipan: number;
  akhir: number;
  sumber_akhir: string;
  nilai_sistem: number;
  hpp: number;
};

// Persediaan awal & akhir + HPP per bulan — satu sumber data untuk Gudang, Akunting, HRD/operasional & SPV.
export default async function Persediaan({ searchParams }: { searchParams: Promise<{ outlet?: string }> }) {
  const s = await getSession();
  if (!s?.active || !BOLEH.includes(s.active.role)) notFound();
  const sp = await searchParams;
  const supabase = await supabaseServer();
  const { data: semua } = await supabase.from("outlet").select("id, nama").eq("mode", "asli").is("deleted_at", null).order("tgl_mulai");
  const outlets = s.active.role === "spv" ? (semua ?? []).filter((o) => o.id === s.active!.outletId) : (semua ?? []);
  const outlet = outlets.find((o) => o.id === sp.outlet) ?? outlets[0];
  if (!outlet) notFound();
  const kini = new Date(Date.now() + 7 * 3600_000);
  const bulan = Array.from({ length: 6 }, (_, i) => new Date(Date.UTC(kini.getUTCFullYear(), kini.getUTCMonth() - i, 1)).toISOString().slice(0, 10));
  const hasil = await Promise.all(bulan.map((b) => supabase.rpc("persediaan_bulanan", { p_outlet: outlet.id, p_periode: b })));
  const data = hasil.map((r) => r.data as P | null).filter((x): x is P => !!x);
  const err = hasil.find((r) => r.error)?.error?.message;
  const ini = data[0];
  // tren 6 bulan, urut lama → baru
  const tren = [...data].reverse().map((d) => ({
    label: new Date(d.periode + "T00:00:00").toLocaleDateString("id-ID", { month: "short", year: "2-digit" }),
    hpp: d.hpp,
    pembelian: d.pembelian,
  }));

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <HeaderHalaman
        judul="Persediaan & HPP"
        ikon="📦"
        keterangan={
          <>
            Rumus Ruma: <b>HPP = persediaan awal + pembelian bahan baku + tagihan dessert & cheesecake − persediaan akhir</b>. Persediaan akhir bulan ini otomatis menjadi persediaan awal bulan depan.
          </>
        }
      >
        <ChipHeader>🏪 {outlet.nama}</ChipHeader>
        {ini && (
          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-matur-700 shadow-sm">
            HPP {namaBulan(ini.periode)}: <span className="tabular-nums">{formatRupiah(ini.hpp)}</span>
          </span>
        )}
      </HeaderHalaman>
      <PilihOutlet outlets={outlets} pilih={outlet.id} href={(id) => `/persediaan?outlet=${id}`} />
      {err && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}

      {ini && (
        <section className="rounded-2xl border border-matur-100 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="mr-auto font-bold text-kopi-900">{namaBulan(ini.periode)} (berjalan)</h2>
            {ini.laporan_id ? (
              <Link href={`/laporan/${ini.laporan_id}`} className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-200">
                ✓ laporan terbit
              </Link>
            ) : (
              <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-semibold text-stone-600">belum terbit</span>
            )}
          </div>
          <dl className="space-y-1.5 text-sm">
            {(
              [
                ["Persediaan awal", ini.awal ?? 0, ini.sumber_awal, ""],
                ["Pembelian bahan baku", ini.pembelian, `kiriman gudang ${formatRupiah(ini.kiriman_gudang)}${Object.entries(ini.pembelian_rincian ?? {}).map(([k, v]) => ` + ${k} ${formatRupiah(Number(v))}`).join("")}`, "+"],
                ["Tagihan dessert & cheesecake", ini.tagihan_titipan, "titipan terjual × harga produsen", "+"],
                ["Persediaan akhir", ini.akhir, ini.sumber_akhir, "−"],
              ] as [string, number, string, string][]
            ).map(([k, v, sub, op]) => (
              <div key={k} className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 border-b border-stone-100 pb-1.5">
                <dt>
                  <span className="mr-1 inline-block w-3 font-bold text-matur-600">{op}</span>
                  {k} <span className="text-xs text-stone-500">· {sub}</span>
                </dt>
                <dd className="tabular-nums">{formatRupiah(v)}</dd>
              </div>
            ))}
            <div className="mt-1 flex flex-wrap justify-between gap-2 rounded-xl bg-matur-50 px-3 py-2.5 text-base font-bold text-kopi-900">
              <dt>Harga pokok penjualan (HPP)</dt>
              <dd className="tabular-nums">{formatRupiah(ini.hpp)}</dd>
            </div>
          </dl>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <Link href="/stok" className="rounded-xl border border-matur-300 px-3 py-1.5 font-semibold text-matur-700 hover:bg-matur-50">Opname / stok awal</Link>
            <Link href={`/titipan?outlet=${outlet.id}`} className="rounded-xl border border-matur-300 px-3 py-1.5 font-semibold text-matur-700 hover:bg-matur-50">Titipan dessert</Link>
            {["owner", "admin_pusat", "finance"].includes(s.active.role) && <Link href={`/laporan/proyeksi?outlet=${outlet.id}`} className="rounded-xl bg-kopi-900 px-3 py-1.5 font-semibold text-white shadow-sm">Tutup buku / proyeksi</Link>}
            {["owner", "admin_pusat", "finance"].includes(s.active.role) && <Link href="/rumus-hpp" className="rounded-xl border border-matur-300 px-3 py-1.5 font-semibold text-matur-700 hover:bg-matur-50">⚙ Atur rumus HPP</Link>}
          </div>
          {ini.sumber_akhir === "perkiraan stok sistem" && <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">Persediaan akhir masih perkiraan sistem. Lakukan opname di akhir bulan agar angkanya pasti.</p>}
        </section>
      )}

      {tren.length > 1 && (
        <ChartCard
          title="Tren HPP 6 bulan"
          sub={outlet.nama}
          rows={tren}
          cols={[
            { key: "label", label: "Bulan" },
            { key: "hpp", label: "HPP", money: true },
            { key: "pembelian", label: "Pembelian", money: true },
          ]}
          className="shadow-sm"
        >
          <TrendChart
            data={tren}
            series={[
              { key: "hpp", name: "HPP", color: SERIES[1] },
              { key: "pembelian", name: "Pembelian", color: SERIES[0] },
            ]}
          />
        </ChartCard>
      )}

      <Kartu judul="Riwayat 6 bulan" keterangan="✓ = sesuai laporan keuangan yang sudah terbit.">
        <div className={tabel.bungkus}>
          <table className={`${tabel.tabel} min-w-[600px]`}>
            <thead className={tabel.kepala}>
              <tr>
                <th className={tabel.th}>Bulan</th>
                <th className={`${tabel.th} text-right`}>Awal</th>
                <th className={`${tabel.th} text-right`}>Pembelian</th>
                <th className={`${tabel.th} text-right`}>Titipan</th>
                <th className={`${tabel.th} text-right`}>Akhir</th>
                <th className={`${tabel.th} text-right`}>HPP</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.periode} className={tabel.baris}>
                  <td className={`${tabel.td} whitespace-nowrap font-medium text-kopi-900`}>
                    {namaBulan(d.periode)} {d.laporan_id && <span className="text-xs text-emerald-700">✓</span>}
                  </td>
                  <td className={`${tabel.td} text-right tabular-nums`}>{formatRupiah(d.awal ?? 0)}</td>
                  <td className={`${tabel.td} text-right tabular-nums`}>{formatRupiah(d.pembelian)}</td>
                  <td className={`${tabel.td} text-right tabular-nums`}>{formatRupiah(d.tagihan_titipan)}</td>
                  <td className={`${tabel.td} text-right tabular-nums`}>{formatRupiah(d.akhir)}</td>
                  <td className={`${tabel.td} text-right font-bold tabular-nums text-kopi-900`}>{formatRupiah(d.hpp)}</td>
                </tr>
              ))}
              {!data.length && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-stone-500">
                    Belum ada data persediaan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Kartu>
    </div>
  );
}
