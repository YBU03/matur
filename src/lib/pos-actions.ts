"use server";

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
