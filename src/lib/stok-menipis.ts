import { batasPeringatanStok, type InfoStokBahan } from "./rincian-stok";
import { supabaseServer } from "./supabase/server";

export type Menipis = { outlet: string; outletId: string; items: { id: string; nama: string; info: InfoStokBahan; urut: number }[] };

/** Bahan resep yang stoknya di bawah batas minimum per outlet (stok berkurang otomatis dari penjualan kasir).
 *  Outlet yang belum pernah opname/stok awal dilewati supaya tidak semua bahan terlihat habis. */
export async function stokMenipis(outlets: { id: string; nama: string }[]): Promise<Menipis[]> {
  if (!outlets.length) return [];
  const supabase = await supabaseServer();
  const [{ data: st, error: se }, { data: rs, error: re }, { data: bh, error: be }, { data: cfg, error: ce }] = await Promise.all([
    supabase.from("stok").select("outlet_id, bahan_id, jumlah").eq("mode", "asli").in("outlet_id", outlets.map((o) => o.id)),
    supabase.from("resep").select("bahan_id").eq("mode", "asli").is("deleted_at", null),
    supabase.from("bahan").select("id, nama, satuan_beli, satuan_pakai, konversi, stok_min").eq("mode", "asli").is("deleted_at", null),
    supabase.from("setelan_stok_outlet").select("outlet_id,bahan_id,minimum,aktif").in("outlet_id", outlets.map(o => o.id)),
  ]);
  if (se || re || be || ce) throw new Error("Data stok belum berhasil dimuat. Coba lagi.");
  const dipakai = new Set((rs ?? []).map((r) => r.bahan_id));
  const bmap = new Map((bh ?? []).map((b) => [b.id, b]));
  return outlets
    .filter((o) => (st ?? []).some((x) => x.outlet_id === o.id))
    .map((o) => ({
      outlet: o.nama,
      outletId: o.id,
      items: [...dipakai]
        .map((bid) => {
          const b = bmap.get(bid);
          if (!b) return null;
          const setting = (cfg ?? []).find(c => c.outlet_id === o.id && c.bahan_id === bid);
          if (setting?.aktif === false) return null;
          const saldo = (st ?? []).find(x => x.outlet_id === o.id && x.bahan_id === bid);
          const jml = saldo ? Number(saldo.jumlah) : null;
          const batas = batasPeringatanStok(Number(b.stok_min ?? 0), Number(b.konversi ?? 1), setting ? Number(setting.minimum) : undefined);
          const min = batas.minimum;
          return jml === null || jml <= min ? { id: bid, nama: b.nama, info: {
            jumlah: jml, satuan: b.satuan_pakai, satuanBeli: b.satuan_beli, konversi: Number(b.konversi), minimum: min,
            sumberMinimum: batas.sumberMinimum,
          }, urut: jml === null ? -Infinity : jml / (min || 1) } : null;
        })
        .filter((x) => x !== null)
        .sort((a, b) => a.urut - b.urut),
    }))
    .filter((m) => m.items.length);
}
