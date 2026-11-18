"use server";
import { revalidatePath } from "next/cache";
import { getSession } from "./session";
import { supabaseServer } from "./supabase/server";
import { buktiTablet } from "./pos-tim";
import type { CartLine } from "./pos-actions";
import type { Promo, PromoQuote } from "./promo";
export async function simpanPromo(
  p: Omit<Promo, "id" | "versi"> & { id?: string; versi?: number },
) {
  const s = await getSession();
  if (
    !s?.active ||
    !["owner", "admin_pusat", "admin_gudang", "hrd", "spv"].includes(
      s.active.role,
    )
  )
    return { error: "Tidak diizinkan" };
  const db = await supabaseServer();
  const { data, error } = await db.rpc("simpan_promo", { p });
  if (error) return { error: error.message };
  revalidatePath("/promo");
  return { id: data as string };
}
export async function daftarPromoKasir() {
  const s = await getSession();
  if (!s?.active?.outletId) return { error: "Pilih outlet" };
  const db = await supabaseServer();
  const { data, error } = await db.rpc("daftar_promo", {
    o: s.active.outletId,
    manajemen: false,
  });
  return error ? { error: error.message } : { data: data as Promo[] };
}
export async function pesanPromo(p: {
  request_id: string;
  promo_id: string;
  sesi_id: string;
  izin_id: string;
  kanal: string;
  diskon: number;
  items: CartLine[];
}) {
  const s = await getSession();
  if (!s?.active?.outletId) return { error: "Pilih outlet" };
  const proof = await buktiTablet();
  const db = await supabaseServer();
  const { data, error } = await db.rpc("pesan_promo", {
    p: {
      ...p,
      outlet_id: s.active.outletId,
      device_token: proof.device,
      pos_token: proof.token,
    },
  });
  return error ? { error: error.message } : { quote: data as PromoQuote };
}
export async function lepasPromo(i: string) {
  const db = await supabaseServer();
  const { error } = await db.rpc("lepas_promo", { i });
  return error ? { error: error.message } : {};
}
