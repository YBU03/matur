"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "./session";
import { supabaseServer } from "./supabase/server";

export type Result = { error?: string; ok?: string };
const GUDANG = ["owner", "admin_pusat", "admin_gudang"];
const izin = async () => {
  const s = await getSession();
  return !!s?.active && GUDANG.includes(s.active.role);
};
const segarkan = (id?: string) => {
  revalidatePath("/gudang/kiriman");
  if (id) revalidatePath(`/gudang/kiriman/${id}`);
};

export async function buatKiriman(form: FormData) {
  if (!(await izin())) return;
  const outlet = String(form.get("outlet") ?? "");
  if (!outlet) return;
  const s = await getSession();
  const supabase = await supabaseServer();
  const { data, error } = await supabase.from("kiriman").insert({ outlet_id: outlet, pengirim: s?.nama ?? null }).select("id").single();
  if (error || !data) return;
  segarkan();
  redirect(`/gudang/kiriman/${data.id}`);
}

export async function simpanInfo(id: string, d: { tanggal: string; catatan: string; pengirim: string }): Promise<Result> {
  if (!(await izin())) return { error: "Tidak diizinkan." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.tanggal)) return { error: "Tanggal tidak valid." };
  const supabase = await supabaseServer();
  const { error, count } = await supabase
    .from("kiriman")
    .update({ tanggal: d.tanggal, catatan: d.catatan.trim().slice(0, 500) || null, pengirim: d.pengirim.trim().slice(0, 100) || null }, { count: "exact" })
    .eq("id", id);
  if (error || !count) return { error: "Hanya kiriman draft yang bisa diubah." };
  segarkan(id);
  return { ok: "Tersimpan." };
}

export async function tambahItem(id: string, bahanId: string, qty: number, harga: number | null): Promise<Result> {
  if (!(await izin())) return { error: "Tidak diizinkan." };
  if (!(qty > 0)) return { error: "Jumlah harus lebih dari 0." };
  const supabase = await supabaseServer();
  const { data: b } = await supabase.from("bahan").select("nama, satuan_beli, konversi, harga_jual_gudang, harga_beli").eq("id", bahanId).single();
  if (!b) return { error: "Bahan tidak ditemukan." };
  const { error } = await supabase.from("item_kiriman").insert({
    kiriman_id: id,
    bahan_id: bahanId,
    nama: b.nama,
    satuan: b.satuan_beli,
    konversi: Number(b.konversi) || 1,
    qty,
    harga: Math.max(0, Math.round(harga ?? b.harga_jual_gudang ?? b.harga_beli ?? 0)),
  });
  if (error) return { error: error.message.includes("row-level") ? "Hanya kiriman draft yang bisa diubah." : error.message };
  segarkan(id);
  return {};
}

export async function ubahItem(id: string, itemId: string, qty: number, harga: number): Promise<Result> {
  if (!(await izin())) return { error: "Tidak diizinkan." };
  if (!(qty > 0) || !(harga >= 0)) return { error: "Jumlah/harga tidak valid." };
  const supabase = await supabaseServer();
  const { error, count } = await supabase.from("item_kiriman").update({ qty, harga: Math.round(harga) }, { count: "exact" }).eq("id", itemId);
  if (error || !count) return { error: "Hanya kiriman draft yang bisa diubah." };
  segarkan(id);
  return {};
}

export async function hapusItem(id: string, itemId: string): Promise<Result> {
  if (!(await izin())) return { error: "Tidak diizinkan." };
  const supabase = await supabaseServer();
  const { error, count } = await supabase.from("item_kiriman").delete({ count: "exact" }).eq("id", itemId);
  if (error || !count) return { error: "Hanya kiriman draft yang bisa diubah." };
  segarkan(id);
  return {};
}

async function rpc(fn: string, args: Record<string, unknown>, id: string, ok: string): Promise<Result> {
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc(fn, args);
  if (error) return { error: error.message };
  segarkan(id);
  return { ok };
}
export async function kirim(id: string) {
  return rpc("kirim_kiriman", { p_id: id }, id, "Kiriman dikirim. Stok gudang sudah dikurangi.");
}
export async function batal(id: string) {
  return rpc("batal_kiriman", { p_id: id }, id, "Kiriman dibatalkan.");
}
export async function terima(id: string, items: { id: string; qty_diterima: number }[], penerima: string) {
  return rpc("terima_kiriman", { p_id: id, p_items: items, p_penerima: penerima }, id, "Kiriman diterima. Stok outlet sudah ditambah.");
}
