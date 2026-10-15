// Data stok real-time (RPC stok_realtime) + smart forecast per bahan.
import type { SupabaseClient } from "@supabase/supabase-js";
import { forecastStok, URUT_STATUS, type Forecast } from "./forecast-stok";

export type BahanRt = {
  id: string; nama: string; kategori: string | null; satuan: string; satuan_beli: string | null; konversi: number; stok_min: number; harga: number;
  stok: number; diubah: string | null; stok_tutup: number | null; masuk_hari_ini: number; harian: { tanggal: string; pakai: number }[];
};
export type ShiftRt = { id: string; kasir: string | null; dibuka_at: string; ditutup_at: string | null; transaksi: number; bahan: { nama: string; satuan: string; jumlah: number }[] };
export type StokRt = { hari: string; tutup_terakhir: string | null; bahan: BahanRt[]; shift: ShiftRt[] };
export type BarisRt = BahanRt & { f: Forecast; pakaiHariIni: number };

export async function ambilStok(supabase: SupabaseClient, outletId: string | null, mode: "asli" | "simulasi" = "asli"): Promise<{ data: StokRt | null; error: string | null }> {
  const { data, error } = await supabase.rpc("stok_realtime", { p_outlet: outletId, p_mode: mode });
  if (error) return { data: null, error: error.message.replace(/^.*?ERROR:\s*/, "") };
  const d = data as StokRt;
  const num = (x: unknown) => Number(x) || 0;
  return {
    data: {
      ...d,
      bahan: d.bahan.map((b) => ({ ...b, konversi: num(b.konversi) || 1, stok_min: num(b.stok_min), harga: num(b.harga), stok: num(b.stok), stok_tutup: b.stok_tutup === null ? null : num(b.stok_tutup), masuk_hari_ini: num(b.masuk_hari_ini), harian: (b.harian ?? []).map((h) => ({ tanggal: h.tanggal, pakai: num(h.pakai) })) })),
      shift: (d.shift ?? []).map((s) => ({ ...s, bahan: s.bahan.map((x) => ({ ...x, jumlah: num(x.jumlah) })) })),
    },
    error: null,
  };
}

/** Hitung forecast tiap bahan, urut dari yang paling mendesak. */
export function olah(d: StokRt, cakupan = 7): BarisRt[] {
  return d.bahan
    .map((b) => ({ ...b, f: forecastStok(b.harian, b.stok, b.stok_min, b.konversi, cakupan), pakaiHariIni: Math.max(b.harian.at(-1)?.pakai ?? 0, 0) }))
    .sort((a, b) => URUT_STATUS[a.f.status] - URUT_STATUS[b.f.status] || (a.f.hariTersisa ?? 999) - (b.f.hariTersisa ?? 999) || a.nama.localeCompare(b.nama));
}

export function hitungStatus(rows: BarisRt[]) {
  const n = { habis: 0, kritis: 0, menipis: 0, aman: 0, tidak_dipakai: 0 };
  for (const r of rows) n[r.f.status]++;
  return n;
}

/** Tampilkan jumlah dalam satuan beli bila ada kemasan (mis. 2.300 g → 2,3 kg). */
export function qty(jumlah: number, b: { satuan: string; satuan_beli: string | null; konversi: number }) {
  const nf = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });
  if (b.konversi > 1 && b.satuan_beli) return `${nf.format(jumlah / b.konversi)} ${b.satuan_beli}`;
  return `${nf.format(jumlah)} ${b.satuan}`;
}

type TitipanRt = { id: string; nama: string; produsen: string; harga_titip: number; harga_jual: number; masuk_total: number; masuk_hari_ini: number; setor_terakhir: string | null; keluar_total: number; sisa: number; harian: { tanggal: string; pakai: number }[] };

/** Stok produk jadi titipan (cheesecake, dessert) per outlet: setoran − terjual − marketing, + forecast (cakupan 3 hari). */
export async function ambilTitipan(supabase: SupabaseClient, outletId: string, mode: "asli" | "simulasi" = "asli"): Promise<BarisRt[]> {
  const { data, error } = await supabase.rpc("stok_titipan", { p_outlet: outletId, p_mode: mode });
  if (error || !data) return [];
  const num = (x: unknown) => Number(x) || 0;
  const bahan: BahanRt[] = (data as TitipanRt[]).map((t) => ({
    id: t.id, nama: t.nama, kategori: t.produsen, satuan: "pcs", satuan_beli: "pcs", konversi: 1, stok_min: 1, harga: num(t.harga_titip),
    stok: num(t.sisa), diubah: t.setor_terakhir, stok_tutup: null, masuk_hari_ini: num(t.masuk_hari_ini),
    harian: (t.harian ?? []).map((h) => ({ tanggal: h.tanggal, pakai: num(h.pakai) })),
  }));
  return olah({ hari: "", tutup_terakhir: null, bahan, shift: [] }, 3);
}
