import { supabaseServer } from "./supabase/server";

export type Menipis = { outlet: string; outletId: string; items: { nama: string; sisa: string; urut: number }[] };

/** Bahan resep yang stoknya di bawah batas minimum per outlet (stok berkurang otomatis dari penjualan kasir).
 *  Outlet yang belum pernah opname/stok awal dilewati supaya tidak semua bahan terlihat habis. */
export async function stokMenipis(outlets: { id: string; nama: string }[]): Promise<Menipis[]> {
  if (!outlets.length) return [];
  const supabase = await supabaseServer();
  const [{ data: st }, { data: rs }, { data: bh }] = await Promise.all([
    supabase.from("stok").select("outlet_id, bahan_id, jumlah").eq("mode", "asli").in("outlet_id", outlets.map((o) => o.id)),
    supabase.from("resep").select("bahan_id").eq("mode", "asli").is("deleted_at", null),
    supabase.from("bahan").select("id, nama, satuan_beli, konversi, stok_min").eq("mode", "asli").is("deleted_at", null),
  ]);
  const dipakai = new Set((rs ?? []).map((r) => r.bahan_id));
  const bmap = new Map((bh ?? []).map((b) => [b.id, b]));
  const nf = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });
  return outlets
    .filter((o) => (st ?? []).some((x) => x.outlet_id === o.id))
    .map((o) => ({
      outlet: o.nama,
      outletId: o.id,
      items: [...dipakai]
        .map((bid) => {
          const b = bmap.get(bid);
          if (!b) return null;
          const jml = Number((st ?? []).find((x) => x.outlet_id === o.id && x.bahan_id === bid)?.jumlah ?? 0);
          const min = Number(b.stok_min ?? 0) || Number(b.konversi ?? 1); // tanpa batas minimum: kurang dari 1 kemasan
          return jml < min ? { nama: b.nama, sisa: `${nf.format(Math.max(jml, 0) / (Number(b.konversi) || 1))} ${b.satuan_beli}`, urut: jml / min } : null;
        })
        .filter((x): x is { nama: string; sisa: string; urut: number } => !!x)
        .sort((a, b) => a.urut - b.urut),
    }))
    .filter((m) => m.items.length);
}
