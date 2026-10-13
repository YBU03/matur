"use server";

// Gudang: pembelian ke supplier, waste/barang rusak, transfer stok antar outlet. Hak akses dijaga RLS & fungsi DB.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseServer } from "./supabase/server";

type Result = { error?: string; ok?: string };
const pesan = (m: string) => (m.includes("row-level") || m.includes("permission") ? "Anda tidak punya akses." : m.replace(/^.*?ERROR:\s*/, ""));
const segarkan = () => {
  for (const p of ["/gudang/pembelian", "/gudang/stok", "/gudang/mutasi", "/stok", "/dashboard"]) revalidatePath(p);
};

export async function buatPembelian(form: FormData) {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("pembelian")
    .insert({ supplier_id: String(form.get("supplier") || "") || null, tanggal: String(form.get("tanggal") || "") || undefined, no_faktur: String(form.get("faktur") || "").trim() || null })
    .select("id")
    .single();
  if (error) throw new Error(pesan(error.message));
  redirect(`/gudang/pembelian?id=${data.id}`);
}

export type ItemBeli = { bahan_id: string; qty: number; harga: number };

/** Simpan isi pembelian draft (mengganti semua baris barang). */
export async function simpanItemPembelian(id: string, items: ItemBeli[], info: { no_faktur: string; catatan: string; supplier_id: string | null }): Promise<Result> {
  const supabase = await supabaseServer();
  const { data: g } = await supabase.from("pembelian").select("status").eq("id", id).single();
  if (g?.status !== "draft") return { error: "Pembelian sudah diterima/batal." };
  const ids = [...new Set(items.map((i) => i.bahan_id))];
  const { data: bahan } = ids.length ? await supabase.from("bahan").select("id, nama, satuan_beli, konversi").in("id", ids) : { data: [] };
  const bmap = new Map((bahan ?? []).map((b) => [b.id, b]));
  const baris = items
    .filter((i) => bmap.has(i.bahan_id) && Number(i.qty) > 0)
    .map((i) => {
      const b = bmap.get(i.bahan_id)!;
      return { pembelian_id: id, bahan_id: b.id, nama: b.nama, satuan: b.satuan_beli, konversi: Number(b.konversi) || 1, qty: Number(i.qty), harga: Math.max(Math.round(Number(i.harga) || 0), 0) };
    });
  // ganti baris lama: hapus via filter id (bukan delete tanpa filter)
  const { data: lama } = await supabase.from("item_pembelian").select("id").eq("pembelian_id", id);
  if (lama?.length) {
    const { error } = await supabase.from("item_pembelian").delete().in("id", lama.map((x) => x.id));
    if (error) return { error: pesan(error.message) };
  }
  if (baris.length) {
    const { error } = await supabase.from("item_pembelian").insert(baris);
    if (error) return { error: pesan(error.message) };
  }
  const total = baris.reduce((s, b) => s + Math.round(b.qty * b.harga), 0);
  const { error } = await supabase.from("pembelian").update({ total, no_faktur: info.no_faktur.trim() || null, catatan: info.catatan.trim() || null, supplier_id: info.supplier_id || null }).eq("id", id);
  if (error) return { error: pesan(error.message) };
  segarkan();
  return { ok: "Pembelian disimpan." };
}

export async function terimaPembelian(id: string): Promise<Result> {
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("terima_pembelian", { p_id: id });
  if (error) return { error: pesan(error.message) };
  segarkan();
  return { ok: "Barang diterima: stok gudang bertambah dan harga beli bahan diperbarui." };
}

export async function batalPembelian(id: string): Promise<Result> {
  const supabase = await supabaseServer();
  const { error } = await supabase.from("pembelian").update({ status: "batal" }).eq("id", id).eq("status", "draft");
  if (error) return { error: pesan(error.message) };
  segarkan();
  return { ok: "Pembelian dibatalkan." };
}

export async function catatWaste(outletId: string | null, bahanId: string, jumlah: number, alasan: string): Promise<Result> {
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("catat_waste", { p_outlet: outletId, p_bahan: bahanId, p_jumlah: jumlah, p_alasan: alasan });
  if (error) return { error: pesan(error.message) };
  segarkan();
  return { ok: "Waste dicatat, stok dikurangi." };
}

export async function transferStok(dari: string, ke: string, items: { bahan_id: string; nama: string; jumlah: number; satuan: string }[], catatan: string): Promise<Result> {
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("transfer_stok_outlet", { p_dari: dari, p_ke: ke, p_items: items, p_catatan: catatan });
  if (error) return { error: pesan(error.message) };
  segarkan();
  return { ok: "Transfer tercatat: stok outlet asal berkurang, tujuan bertambah." };
}
