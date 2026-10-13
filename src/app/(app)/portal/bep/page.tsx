import Image from "next/image";
import { notFound } from "next/navigation";
import { ChartCard, TrendChart } from "@/components/charts";
import { PilihOutlet } from "@/components/pilih-outlet";
import { SERIES } from "@/lib/chart-utils";
import { formatRupiah } from "@/lib/format";
import { hitung, LAPORAN_COLS, namaBulan, type Laporan } from "@/lib/laporan";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

// BEP outlet: akumulasi laba bersih dibanding investasi awal di perjanjian. Data per outlet terpisah (RLS).
export default async function Bep({ searchParams }: { searchParams: Promise<{ outlet?: string }> }) {
  const s = await getSession();
  if (!s?.active || !["owner", "admin_pusat", "finance", "mitra"].includes(s.active.role)) notFound();
  const supabase = await supabaseServer();
  const [{ data: pj }, { data: rows }] = await Promise.all([
    supabase.from("perjanjian").select("outlet_id, investasi_awal, outlet(nama), mitra(nama)").eq("mode", "asli").is("deleted_at", null),
    supabase.from("laporan_bulanan").select(LAPORAN_COLS).eq("mode", "asli").is("deleted_at", null).order("periode"),
  ]);
  const janji = (pj ?? []) as unknown as { outlet_id: string; investasi_awal: number; outlet: { nama: string } | null; mitra: { nama: string } | null }[];
  const outlets = [...new Map(janji.map((j) => [j.outlet_id, { id: j.outlet_id, nama: j.outlet?.nama ?? "-" }])).values()];
  const pilih = (await searchParams).outlet ?? outlets[0]?.id;
  const p = janji.filter((j) => j.outlet_id === pilih);
  const investasi = p.reduce((t, j) => t + Number(j.investasi_awal || 0), 0);
  const list = ((rows ?? []) as unknown as Laporan[]).filter((l) => l.outlet_id === pilih);
  let akum = 0;
  const tren = list.map((l) => {
    akum += hitung(l).labaBersih;
    return { label: namaBulan(l.periode), laba: hitung(l).labaBersih, akumulasi: akum };
  });
  const rata = list.length ? akum / list.length : 0;
  const persen = investasi ? Math.min((akum / investasi) * 100, 100) : 0;
  const sisa = Math.max(investasi - akum, 0);
  const bulanLagi = rata > 0 ? Math.ceil(sisa / rata) : null;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">BEP & Pengembalian Investasi</h1>
        <p className="text-sm text-stone-500">Akumulasi laba bersih outlet dibanding investasi awal, dari laporan bulanan yang sudah terbit.</p>
      </div>
      <PilihOutlet outlets={outlets} pilih={pilih} href={(id) => `/portal/bep?outlet=${id}`} />
      {!p.length || !investasi ? (
        <p className="rounded-2xl border border-matur-200 bg-white p-8 text-center text-sm text-stone-400">Investasi awal belum diisi di Perjanjian Mitra.</p>
      ) : (
        <>
          <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-matur-200 bg-white p-4">
            <Image src="/brand/outlet.png" alt="" width={72} height={72} className="rounded-xl bg-matur-50" />
            <div className="min-w-48 flex-1">
              <p className="font-bold">{p[0].outlet?.nama}</p>
              <p className="text-xs text-stone-500">Mitra: {p.map((j) => j.mitra?.nama).filter(Boolean).join(", ")}</p>
              <div className="mt-2 h-4 overflow-hidden rounded-full bg-stone-100" role="img" aria-label={`BEP ${persen.toFixed(1)}%`}>
                <div className="h-full rounded-full" style={{ width: `${persen}%`, background: SERIES[2] }} />
              </div>
              <p className="mt-1 text-sm">
                <b>{persen.toFixed(1).replace(".", ",")}%</b> kembali · {formatRupiah(akum)} dari {formatRupiah(investasi)}
              </p>
            </div>
          </section>
          <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {[
              ["Investasi awal", formatRupiah(investasi)],
              ["Akumulasi laba", formatRupiah(akum)],
              ["Rata-rata / bulan", formatRupiah(Math.round(rata))],
              ["Perkiraan BEP", sisa === 0 ? "Sudah BEP 🎉" : bulanLagi ? `± ${bulanLagi} bulan lagi` : "-"],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl border border-matur-200 bg-white p-3">
                <p className="text-xs text-stone-500">{k}</p>
                <p className="text-base font-bold tabular-nums">{v}</p>
              </div>
            ))}
          </section>
          {tren.length > 0 && (
            <ChartCard title="Akumulasi laba bersih" sub="Naik setiap bulan menuju nilai investasi" rows={tren} cols={[{ key: "label", label: "Bulan" }, { key: "laba", label: "Laba bulan itu", money: true }, { key: "akumulasi", label: "Akumulasi", money: true }]}>
              <TrendChart data={tren} series={[{ key: "akumulasi", name: "Akumulasi", color: SERIES[2] }, { key: "laba", name: "Laba bulan itu", color: SERIES[0] }]} />
            </ChartCard>
          )}
          <p className="text-xs text-stone-400">Perkiraan memakai rata-rata laba bersih bulanan; angka sebenarnya bisa berbeda.</p>
        </>
      )}
    </div>
  );
}
