"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { getSession } from "./session";
import { supabaseServer } from "./supabase/server";

export type CartLine = { menu_id: string; varian_ids: string[]; qty: number; catatan?: string };
export type Checkout = {
  client_id: string;
  kanal: string;
  tipe: "dine_in" | "take_away";
  pelanggan?: string;
  meja?: string;
  diskon: number;
  metode: string;
  diterima?: number;
  /** split payment: beberapa metode; jumlah nominal harus sama dengan total */
  pembayaran?: { metode: string; nominal: number; diterima?: number }[];
  /** izin diskon besar dari SPV (sekali pakai) */
  otorisasi?: string;
  items: CartLine[];
};
export type Receipt = { id: string; nomor: number; subtotal: number; diskon: number; total: number; kembalian: number };

async function outlet() {
  const s = await getSession();
  return s?.active?.outletId ?? null;
}

export async function bukaShift(modal: number): Promise<{ error?: string }> {
  const o = await outlet();
  if (!o) return { error: "Pilih outlet terlebih dahulu." };
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("buka_sesi_kas", { p_outlet: o, p_modal: Math.round(modal) || 0 });
  if (error) return { error: error.message };
  revalidatePath("/kasir/pos");
  return {};
}

export async function bayar(c: Checkout): Promise<{ error?: string; receipt?: Receipt }> {
  const o = await outlet();
  if (!o) return { error: "Pilih outlet terlebih dahulu." };
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("buat_transaksi", { p: { ...c, outlet_id: o } });
  if (error) return { error: error.message };
  revalidatePath("/kasir/antrean");
  return { receipt: data as Receipt };
}

export async function ubahStatus(id: string, status: "diproses" | "siap" | "diambil"): Promise<{ error?: string }> {
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("ubah_status_pesanan", { p_id: id, p_status: status });
  if (error) return { error: error.message };
  revalidatePath("/kasir/antrean");
  return {};
}

/** Masuk sebagai SPV/Owner di klien terpisah (sesi kasir di perangkat ini tidak berubah).
 *  Kode staf → PIN, email → password. */
async function klienAtasan(login: string, rahasia: string) {
  const l = login.trim().toLowerCase();
  if (!l || !rahasia) return null;
  const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = l.includes("@")
    ? await c.auth.signInWithPassword({ email: l, password: rahasia })
    : await c.auth.signInWithPassword({ email: `${l}@pin.matur.id`, password: `pin:${rahasia}:${process.env.PIN_PEPPER}` });
  return error ? null : c;
}
const pesanDb = (m: string) => m.replace(/^.*?ERROR:\s*/, "");

/** SPV menyetujui diskon besar dengan PIN-nya di perangkat kasir; hasilnya kode izin sekali pakai (10 menit). */
export async function izinDiskonSpv(login: string, rahasia: string, persen: number): Promise<{ error?: string; otorisasi?: string; nama?: string }> {
  const o = await outlet();
  if (!o) return { error: "Pilih outlet terlebih dahulu." };
  const c = await klienAtasan(login, rahasia);
  if (!c) return { error: "Kode/email atau PIN/password SPV salah." };
  const { data, error } = await c.rpc("izinkan_diskon", { p_outlet: o, p_persen: Math.ceil(persen) });
  if (error) return { error: pesanDb(error.message) };
  const { data: u } = await c.from("pengguna").select("nama").eq("id", (await c.auth.getUser()).data.user!.id).single();
  return { otorisasi: data as string, nama: u?.nama };
}

/** Void transaksi: disetujui SPV (PIN) selama shift masih buka; stok resep dikembalikan. */
export async function voidTransaksi(id: string, alasan: string, login: string, rahasia: string): Promise<{ error?: string; ok?: string }> {
  const c = await klienAtasan(login, rahasia);
  if (!c) return { error: "Kode/email atau PIN/password SPV salah." };
  const { error } = await c.rpc("void_transaksi", { p_id: id, p_alasan: alasan });
  if (error) return { error: pesanDb(error.message) };
  revalidatePath("/kasir/riwayat");
  revalidatePath("/kasir/antrean");
  return { ok: "Transaksi dibatalkan (void). Stok bahan dikembalikan." };
}
