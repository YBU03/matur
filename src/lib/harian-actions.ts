"use server";

// Catatan harian: input manual (angka dashboard platform & koreksi), produk keluar untuk marketing, rumus HPP.
import { revalidatePath } from "next/cache";
import type { KanalHarian } from "./harian";
import { getSession } from "./session";
import { supabaseServer } from "./supabase/server";

type Result = { error?: string; ok?: string };
const pesan = (m: string) => (m.includes("row-level") || m.includes("permission") ? "Anda tidak punya akses untuk outlet ini." : m.replace(/^.*?ERROR:\s*/, ""));
const segarkan = () => {
  for (const p of ["/catatan-harian", "/laporan/proyeksi", "/persediaan", "/titipan", "/kasir/shift"]) revalidatePath(p);
};
const tglOk = (t: string) => /^\d{4}-\d{2}-\d{2}$/.test(t);

/** Simpan angka dashboard platform (GoFood, Grab, Shopee, TikTok) satu tanggal; kosong = pakai angka POS. */
export async function simpanAngkaPlatform(outletId: string, tanggal: string, angka: Partial<Record<KanalHarian, number | null>>, keterangan: string): Promise<Result> {
  if (!tglOk(tanggal)) return { error: "Tanggal tidak valid." };
  const supabase = await supabaseServer();
  const kanal = Object.keys(angka) as KanalHarian[];
  // angka lama untuk kanal yang diubah ditandai terhapus (riwayat tetap ada di log)
  const { data: lama } = await supabase.from("penjualan_manual").select("id, kanal").eq("outlet_id", outletId).eq("tanggal", tanggal).eq("jenis", "platform").is("deleted_at", null).in("kanal", kanal);
  if (lama?.length) {
    const { error } = await supabase.from("penjualan_manual").update({ deleted_at: new Date().toISOString() }).in("id", lama.map((x) => x.id));
    if (error) return { error: pesan(error.message) };
  }
  const baris = kanal.filter((k) => angka[k] !== null && angka[k] !== undefined).map((k) => ({ outlet_id: outletId, tanggal, kanal: k, jenis: "platform", jumlah: Math.round(Number(angka[k])), keterangan: keterangan.trim() || "angka dashboard platform" }));
  if (baris.length) {
    const { error } = await supabase.from("penjualan_manual").insert(baris);
    if (error) return { error: pesan(error.message) };
  }
  segarkan();
  return { ok: "Angka penjualan tersimpan." };
}

/** Koreksi (±) satu kanal pada satu tanggal, mis. salah input kasir. */
export async function simpanKoreksi(outletId: string, d: { id?: string; tanggal: string; kanal: KanalHarian; jumlah: number; keterangan: string }): Promise<Result> {
  if (!tglOk(d.tanggal)) return { error: "Tanggal tidak valid." };
  const j = Math.round(Number(d.jumlah));
  if (!j) return { error: "Jumlah koreksi tidak boleh 0." };
  if (!d.keterangan.trim()) return { error: "Tulis alasan koreksi." };
  const supabase = await supabaseServer();
  const v = { kanal: d.kanal, jumlah: j, keterangan: d.keterangan.trim().slice(0, 200), tanggal: d.tanggal };
  const { error } = d.id
    ? await supabase.from("penjualan_manual").update(v).eq("id", d.id)
    : await supabase.from("penjualan_manual").insert({ ...v, outlet_id: outletId, jenis: "koreksi" });
  if (error) return { error: pesan(error.message) };
  segarkan();
  return { ok: d.id ? "Koreksi diperbarui." : "Koreksi ditambahkan." };
}

export async function hapusManual(id: string): Promise<Result> {
  const supabase = await supabaseServer();
  const { error } = await supabase.from("penjualan_manual").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) return { error: pesan(error.message) };
  segarkan();
  return { ok: "Input manual dihapus." };
}

export type ProdukKeluarInput = { outlet_id: string; tanggal?: string; jenis: string; penerima: string; catatan: string; items: { menu_id: string; qty: number }[] };
export async function catatProdukKeluar(d: ProdukKeluarInput): Promise<Result> {
  if (!d.items.length || d.items.some(i => !i.menu_id || !Number.isSafeInteger(i.qty) || i.qty <= 0)) return { error: "Pilih produk dan jumlah bulat lebih dari nol." };
  if (!d.penerima.trim()) return { error: "Isi nama penerima (mis. akun influencer)." };
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("catat_produk_keluar", { p: d });
  if (error) return { error: pesan(error.message) };
  segarkan();
  return { ok: "Produk marketing dicatat, stok bahan dipotong." };
}

export async function hapusProdukKeluar(id: string): Promise<Result> {
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("hapus_produk_keluar", { p_id: id });
  if (error) return { error: pesan(error.message) };
  segarkan();
  return { ok: "Dibatalkan, stok dikembalikan." };
}

export async function aturRumusHpp(rumus: { kiriman_gudang: boolean; titipan: boolean; label_titipan?: string }, grup: Record<string, string>): Promise<Result> {
  const s = await getSession();
  if (!s?.active || !["owner", "admin_pusat", "finance"].includes(s.active.role)) return { error: "Hanya Owner/Akunting." };
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("atur_rumus_hpp", { p_rumus: rumus, p_grup: grup });
  if (error) return { error: pesan(error.message) };
  segarkan();
  revalidatePath("/rumus-hpp");
  return { ok: "Rumus HPP disimpan." };
}

/** Owner: isi data simulasi bulan berjalan (mode simulasi) untuk menguji relasi POS → catatan harian → laporan. */
export async function isiDataSimulasi(outletId: string): Promise<Result> {
  const s = await getSession();
  if (s?.active?.role !== "owner") return { error: "Hanya Owner." };
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("isi_data_simulasi", { p_outlet: outletId });
  if (error) return { error: pesan(error.message) };
  segarkan();
  revalidatePath("/dashboard");
  const r = data as { hari: number; transaksi: number };
  return { ok: `Data simulasi terisi: ${r.hari} hari, ${r.transaksi} transaksi.` };
}

export async function hapusDataSimulasi(outletId: string): Promise<Result> {
  const s = await getSession();
  if (s?.active?.role !== "owner") return { error: "Hanya Owner." };
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("hapus_data_simulasi", { p_outlet: outletId });
  if (error) return { error: pesan(error.message) };
  segarkan();
  revalidatePath("/dashboard");
  return { ok: "Data simulasi outlet ini dihapus." };
}

export type TrxRincian = { id: string; nomor: number; waktu: string; kanal: string; subtotal: number; diskon: number; total: number; kasir: string; bayar: { metode: string; nominal: number }[]; items: string | null };
/** Rincian transaksi satu hari operasional (untuk panel "asal uang" di Catatan Harian). */
export async function rincianHarian(outletId: string, tanggal: string, sim = false): Promise<{ data?: TrxRincian[]; error?: string }> {
  if (!tglOk(tanggal)) return { error: "Tanggal tidak valid." };
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("rincian_harian", { p_outlet: outletId, p_tanggal: tanggal, p_mode: sim ? "simulasi" : "asli" });
  if (error) return { error: pesan(error.message) };
  return { data: (data ?? []) as TrxRincian[] };
}

export type Perbaikan = { waktu: string; siapa: string; jenis: string; tanggal: string; judul: string; lama: Record<string, unknown> | null; baru: Record<string, unknown> | null };
/** Riwayat perbaikan admin (koreksi transaksi, pengeluaran, input manual) untuk satu bulan. */
export async function riwayatPerbaikan(outletId: string, bulan: string): Promise<{ data?: Perbaikan[]; error?: string }> {
  if (!/^\d{4}-\d{2}$/.test(bulan)) return { error: "Bulan tidak valid." };
  const awal = `${bulan}-01`;
  const d = new Date(awal + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("riwayat_perbaikan_harian", { p_outlet: outletId, p_awal: awal, p_akhir: d.toISOString().slice(0, 10) });
  if (error) return { error: pesan(error.message) };
  return { data: (data ?? []) as Perbaikan[] };
}

/** Kembalikan satu sel ke angka POS: hapus (arsip) semua input manual & koreksi kanal itu pada tanggal itu. */
export async function kembalikanKePos(outletId: string, tanggal: string, kanal: KanalHarian): Promise<Result> {
  if (!tglOk(tanggal)) return { error: "Tanggal tidak valid." };
  const supabase = await supabaseServer();
  const { error, count } = await supabase
    .from("penjualan_manual")
    .update({ deleted_at: new Date().toISOString() }, { count: "exact" })
    .eq("outlet_id", outletId)
    .eq("tanggal", tanggal)
    .eq("kanal", kanal)
    .eq("mode", "asli")
    .is("deleted_at", null);
  if (error) return { error: pesan(error.message) };
  segarkan();
  return { ok: count ? `Dikembalikan ke angka POS (${count} penyesuaian diarsipkan).` : "Sudah sama dengan angka POS." };
}
