import Link from "next/link";
import { notFound } from "next/navigation";
import { PilihOutlet } from "@/components/pilih-outlet";
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

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Persediaan & HPP</h1>
        <p className="text-sm text-stone-500">
          Rumus Ruma: <b>HPP = persediaan awal + pembelian bahan baku + tagihan dessert & cheesecake − persediaan akhir</b>. Persediaan akhir bulan ini otomatis menjadi persediaan awal bulan depan.
        </p>
      </div>
      <PilihOutlet outlets={outlets} pilih={outlet.id} href={(id) => `/persediaan?outlet=${id}`} />
      {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}

      {ini && (
        <section className="rounded-2xl border border-matur-200 bg-white p-4">
          <div className="mb-2 flex flex-wrap items-baseline gap-2">
            <h2 className="mr-auto font-bold">{namaBulan(ini.periode)} (berjalan)</h2>
            {ini.laporan_id ? <Link href={`/laporan/${ini.laporan_id}`} className="text-sm text-matur-700 underline">laporan terbit</Link> : <span className="text-xs text-stone-500">belum terbit</span>}
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
              <div key={k} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-stone-100 pb-1.5">
                <dt>
                  <span className="mr-1 inline-block w-3 text-stone-400">{op}</span>
                  {k} <span className="text-xs text-stone-500">· {sub}</span>
                </dt>
                <dd className="tabular-nums">{formatRupiah(v)}</dd>
              </div>
            ))}
            <div className="flex justify-between pt-1 text-base font-bold">
              <dt>Harga pokok penjualan (HPP)</dt>
              <dd className="tabular-nums">{formatRupiah(ini.hpp)}</dd>
            </div>
          </dl>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <Link href="/stok" className="rounded-lg border border-matur-300 px-3 py-1.5 font-semibold text-matur-700">Opname / stok awal</Link>
            <Link href={`/titipan?outlet=${outlet.id}`} className="rounded-lg border border-matur-300 px-3 py-1.5 font-semibold text-matur-700">Titipan dessert</Link>
            {["owner", "admin_pusat", "finance"].includes(s.active.role) && <Link href={`/laporan/proyeksi?outlet=${outlet.id}`} className="rounded-lg bg-kopi-900 px-3 py-1.5 font-semibold text-white">Tutup buku / proyeksi</Link>}
            {["owner", "admin_pusat", "finance"].includes(s.active.role) && <Link href="/rumus-hpp" className="rounded-lg border border-matur-300 px-3 py-1.5 font-semibold text-matur-700">⚙ Atur rumus HPP</Link>}
          </div>
          {ini.sumber_akhir === "perkiraan stok sistem" && <p className="mt-2 text-xs text-amber-700">Persediaan akhir masih perkiraan sistem. Lakukan opname di akhir bulan agar angkanya pasti.</p>}
        </section>
      )}

      <section className="overflow-x-auto rounded-2xl border border-matur-200 bg-white p-4">
        <h2 className="mb-2 font-bold">Riwayat 6 bulan</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-stone-500">
            <tr>
              <th className="py-1">Bulan</th>
              <th className="text-right">Awal</th>
              <th className="text-right">Pembelian</th>
              <th className="text-right">Titipan</th>
              <th className="text-right">Akhir</th>
              <th className="text-right">HPP</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.periode} className="border-t">
                <td className="py-1.5">
                  {namaBulan(d.periode)} {d.laporan_id && <span className="text-xs text-green-700">✓</span>}
                </td>
                <td className="text-right tabular-nums">{formatRupiah(d.awal ?? 0)}</td>
                <td className="text-right tabular-nums">{formatRupiah(d.pembelian)}</td>
                <td className="text-right tabular-nums">{formatRupiah(d.tagihan_titipan)}</td>
                <td className="text-right tabular-nums">{formatRupiah(d.akhir)}</td>
                <td className="text-right font-semibold tabular-nums">{formatRupiah(d.hpp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-1 text-xs text-stone-500">✓ = sesuai laporan keuangan yang sudah terbit.</p>
      </section>
    </div>
  );
}
