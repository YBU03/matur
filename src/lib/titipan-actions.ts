"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "./supabase/server";

/** Catat setoran barang titipan dari produsen (qty negatif = retur/koreksi). */
export async function catatTitipan(outletId: string, menuId: string, qty: number, tanggal: string, catatan: string, jenis: "masuk" | "retur" | "rusak" | "koreksi" = "masuk", barangId?: string): Promise<{ error?: string; ok?: string }> {
  const q = Math.round(Number(qty));
  if (!q) return { error: "Jumlah tidak boleh 0." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) return { error: "Tanggal tidak valid." };
  const supabase = await supabaseServer();
  const { error } = await supabase.from("titipan_masuk").insert({ outlet_id: outletId, ...(barangId ? { barang_id: barangId, menu_id: null } : { menu_id: menuId }), qty: q, tanggal, jenis, catatan: catatan.trim().slice(0, 200) || null });
  if (error) return { error: error.message.includes("row-level") ? "Anda tidak punya akses mencatat titipan di outlet ini." : error.message };
  revalidatePath("/titipan");
  revalidatePath("/persediaan");
  return { ok: q > 0 ? `Setoran ${q} dicatat.` : `Retur/koreksi ${-q} dicatat.` };
}

type Hasil = { error?: string; ok?: string };
const pesanGalat = (m: string) => (/could not find the function|does not exist/i.test(m) ? "Fitur edit/hapus titipan sedang disiapkan di database, coba lagi nanti." : m.includes("row-level") || m.includes("akses") ? "Anda tidak punya akses mengelola titipan di outlet ini." : m.replace(/^.*?ERROR:\s*/, ""));

/** Ubah satu catatan pergerakan titipan (jumlah, tanggal, jenis, catatan). Tercatat di log aktivitas. */
export async function ubahTitipan(id: string, qty: number, tanggal: string, jenis: "masuk" | "retur" | "rusak" | "koreksi", catatan: string): Promise<Hasil> {
  const q = Math.round(Number(qty));
  if (!q) return { error: "Jumlah tidak boleh 0." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) return { error: "Tanggal tidak valid." };
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("ubah_titipan_masuk", { p_id: id, p_qty: q, p_tanggal: tanggal, p_jenis: jenis, p_catatan: catatan.trim().slice(0, 200) });
  if (error) return { error: pesanGalat(error.message) };
  revalidatePath("/titipan");
  revalidatePath("/persediaan");
  return { ok: (data as { ok?: string })?.ok ?? "Catatan titipan diperbarui." };
}

/** Hapus satu catatan pergerakan titipan (data lama disimpan di log aktivitas). */
export async function hapusTitipan(id: string, alasan = ""): Promise<Hasil> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("hapus_titipan_masuk", { p_id: id, p_alasan: alasan.trim().slice(0, 200) });
  if (error) return { error: pesanGalat(error.message) };
  revalidatePath("/titipan");
  revalidatePath("/persediaan");
  return { ok: (data as { ok?: string })?.ok ?? "Catatan titipan dihapus." };
}

export type BarangTitipanInput = { id?: string; nama: string; kelompok: "dessert" | "snack" | "lain"; satuan: string; harga: number; produsen?: string; keterangan?: string; aktif?: boolean };

/** Tambah / ubah barang titipan (harga per pcs/gram). HPP menu yang memakai barang ini ikut diperbarui. */
export async function simpanBarangTitipan(b: BarangTitipanInput): Promise<Hasil> {
  if (!b.nama?.trim()) return { error: "Isi nama barang." };
  if (!(Number(b.harga) >= 0)) return { error: "Harga satuan tidak valid." };
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("simpan_barang_titipan", { p: { ...b, harga: Number(b.harga) } });
  if (error) return { error: pesanGalat(error.message) };
  revalidatePath("/titipan");
  return { ok: b.id ? "Barang titipan diperbarui." : "Barang titipan ditambahkan." };
}

export async function hapusBarangTitipan(id: string): Promise<Hasil> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("hapus_barang_titipan", { p_id: id });
  if (error) return { error: pesanGalat(error.message) };
  revalidatePath("/titipan");
  return { ok: (data as { ok?: string })?.ok ?? "Barang dihapus." };
}

/** Simpan isi satu menu titipan (mis. Mix Platter = 3 sosis + 3 nugget + 50 gram french fries). */
export async function simpanIsiTitipan(menuId: string, isi: { barang_id: string; qty: number }[]): Promise<Hasil> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("simpan_isi_titipan", { p_menu: menuId, p_isi: isi.filter((x) => x.barang_id && Number(x.qty) > 0) });
  if (error) return { error: pesanGalat(error.message) };
  revalidatePath("/titipan");
  revalidatePath("/master/menu");
  return { ok: (data as { ok?: string })?.ok ?? "Isi menu disimpan." };
}

/** Simpan beberapa catatan titipan sekaligus (mis. satu nota setoran berisi banyak barang, atau hasil hitung fisik). */
export async function catatTitipanBanyak(
  outletId: string,
  tanggal: string,
  baris: { barang_id: string; qty: number; jenis: "masuk" | "retur" | "rusak" | "koreksi"; catatan: string }[],
): Promise<Hasil> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) return { error: "Tanggal tidak valid." };
  const isi = baris
    .map((b) => ({ ...b, qty: Math.round(Number(b.qty)) }))
    .filter((b) => b.barang_id && b.qty)
    .map((b) => ({ outlet_id: outletId, barang_id: b.barang_id, menu_id: null, tanggal, qty: b.qty, jenis: b.jenis, catatan: b.catatan.trim().slice(0, 200) || null }));
  if (!isi.length) return { error: "Isi minimal satu jumlah barang." };
  const supabase = await supabaseServer();
  const { error } = await supabase.from("titipan_masuk").insert(isi);
  if (error) return { error: pesanGalat(error.message) };
  revalidatePath("/titipan");
  return { ok: `${isi.length} catatan titipan tersimpan.` };
}
