import Image from "next/image";
import Link from "next/link";
import { formatRupiah } from "@/lib/format";
import { hitung, LAPORAN_COLS, namaBulan, type Laporan } from "@/lib/laporan";
import { penerimaanMitra } from "@/lib/penerimaan-mitra";
import { supabaseServer } from "@/lib/supabase/server";

// Ringkasan untuk mitra di dashboard: laporan terakhir, penerimaan, dan progres BEP (data outletnya saja, lewat RLS).
export async function MitraRingkas({ userId, nama }: { userId: string; nama: string }) {
  const supabase = await supabaseServer();
  const [{ data: rows }, { data: m }, { data: pj }] = await Promise.all([
    supabase.from("laporan_bulanan").select(LAPORAN_COLS).eq("mode", "asli").is("deleted_at", null).order("periode"),
    supabase.from("mitra").select("nama").eq("pengguna_id", userId).is("deleted_at", null),
    supabase.from("perjanjian").select("outlet_id, investasi_awal").eq("mode", "asli").is("deleted_at", null),
  ]);
  const laporan = (rows ?? []) as unknown as Laporan[];
  if (!laporan.length) return null;
  const namaSaya = (m ?? []).map((x) => x.nama)[0] ?? nama;
  const terakhir = laporan[laporan.length - 1];
  const h = hitung(terakhir);
  const terima = penerimaanMitra(laporan, namaSaya);
  const totalTerima = terima.reduce((t, x) => t + x.total, 0);
  const terimaTerakhir = terima.find((x) => x.periode === terakhir.periode)?.total ?? 0;
  const invest = (pj ?? []).filter((j) => j.outlet_id === terakhir.outlet_id).reduce((t, j) => t + Number(j.investasi_awal || 0), 0);
  const akum = laporan.filter((l) => l.outlet_id === terakhir.outlet_id).reduce((t, l) => t + hitung(l).labaBersih, 0);
  const persen = invest ? Math.min((akum / invest) * 100, 100) : null;
  return (
    <section className="space-y-3 rounded-2xl border border-matur-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <Image src="/brand/outlet.png" alt="" width={48} height={48} className="rounded-xl bg-matur-50" />
        <div className="mr-auto">
          <p className="font-bold">{terakhir.nama_outlet}</p>
          <p className="text-xs text-stone-500">Laporan terakhir: {namaBulan(terakhir.periode)}</p>
        </div>
        <Link href={`/laporan/${terakhir.id}`} className="rounded-lg bg-kopi-900 px-3 py-1.5 text-sm font-semibold text-white">
          Buka laporan
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {[
          ["Penjualan", formatRupiah(h.totalPenjualan)],
          ["Laba bersih outlet", formatRupiah(h.labaBersih)],
          ["Penerimaan Anda bulan itu", formatRupiah(terimaTerakhir)],
          ["Total penerimaan Anda", formatRupiah(totalTerima)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-matur-50 p-3">
            <p className="text-xs text-stone-500">{k}</p>
            <p className="font-bold tabular-nums">{v}</p>
          </div>
        ))}
      </div>
      {persen !== null && (
        <Link href="/portal/bep" className="block">
          <div className="flex justify-between text-xs text-stone-600">
            <span>Progres BEP outlet</span>
            <b>{persen.toFixed(1).replace(".", ",")}%</b>
          </div>
          <div className="mt-1 h-3 overflow-hidden rounded-full bg-stone-100">
            <div className="h-full rounded-full bg-[#1baf7a]" style={{ width: `${persen}%` }} />
          </div>
        </Link>
      )}
    </section>
  );
}
