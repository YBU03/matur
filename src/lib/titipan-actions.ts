"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "./supabase/server";

/** Catat setoran barang titipan dari produsen (qty negatif = retur/koreksi). */
export async function catatTitipan(outletId: string, menuId: string, qty: number, tanggal: string, catatan: string, jenis: "masuk" | "retur" | "rusak" | "koreksi" = "masuk"): Promise<{ error?: string; ok?: string }> {
  const q = Math.round(Number(qty));
  if (!q) return { error: "Jumlah tidak boleh 0." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) return { error: "Tanggal tidak valid." };
  const supabase = await supabaseServer();
  const { error } = await supabase.from("titipan_masuk").insert({ outlet_id: outletId, menu_id: menuId, qty: q, tanggal, jenis, catatan: catatan.trim().slice(0, 200) || null });
  if (error) return { error: error.message.includes("row-level") ? "Anda tidak punya akses mencatat titipan di outlet ini." : error.message };
  revalidatePath("/titipan");
  revalidatePath("/persediaan");
  return { ok: q > 0 ? `Setoran ${q} pcs dicatat.` : `Retur/koreksi ${-q} pcs dicatat.` };
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
