import { notFound } from "next/navigation";
import { hitung, LAPORAN_COLS, type Laporan } from "@/lib/laporan";
import type { Rincian } from "@/lib/skema-actions";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { SimulasiView, type Acuan } from "./simulasi-view";

// Simulasi kemitraan untuk calon mitra: proyeksi laba & BEP dari asumsi, bisa diisi dari rata-rata outlet berjalan.
export default async function Simulasi() {
  const s = await getSession();
  if (!s?.active || !["owner", "admin_pusat", "finance"].includes(s.active.role)) notFound();
  const supabase = await supabaseServer();
  const [{ data: skema }, { data: rows }, { data: outlets }] = await Promise.all([
    supabase.from("skema_bagi_hasil").select("id, nama, persen_sedekah, rincian").order("nama"),
    supabase.from("laporan_bulanan").select(LAPORAN_COLS).eq("mode", "asli").is("deleted_at", null).order("periode", { ascending: false }),
    supabase.from("outlet").select("id, nama").eq("mode", "asli").is("deleted_at", null),
  ]);
  const laporan = (rows ?? []) as unknown as Laporan[];
  // acuan: rata-rata 3 laporan terakhir per outlet
  const acuan: Acuan[] = (outlets ?? [])
    .map((o) => {
      const xs = laporan.filter((l) => l.outlet_id === o.id).slice(0, 3);
      if (!xs.length) return null;
      const hs = xs.map((l) => ({ h: hitung(l), sedekah: Number(l.sedekah) || 0 }));
      const rata = (f: (x: (typeof hs)[number]) => number) => hs.reduce((t, x) => t + f(x), 0) / hs.length;
      const jual = rata((x) => x.h.totalPenjualan);
      // beban operasional tanpa sedekah (sedekah dihitung terpisah dari laba kotor)
      return { nama: o.nama, bulan: xs.length, omzet: Math.round(jual), hpp: jual ? Math.round((rata((x) => x.h.hpp) / jual) * 1000) / 10 : 0, beban: Math.round(rata((x) => x.h.totalBeban - x.sedekah)) };
    })
    .filter((x): x is Acuan => !!x);
  return (
    <SimulasiView
      skema={(skema ?? []).map((k) => {
        const r = (k.rincian ?? []) as Rincian[];
        return { id: k.id, nama: k.nama, sedekah: Number(k.persen_sedekah) || 0, mitra: r.filter((x) => !x.pengelola).reduce((t, x) => t + Number(x.persen), 0) };
      })}
      acuan={acuan}
    />
  );
}
