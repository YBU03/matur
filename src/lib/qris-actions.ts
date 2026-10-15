"use server";

import { revalidatePath } from "next/cache";
import { cekQris } from "./qris";
import { getSession } from "./session";
import { supabaseServer } from "./supabase/server";

export type Result = { error?: string; ok?: string };

/** Simpan QRIS outlet (gambar & / atau isi kode QRIS statis). Owner / Admin Pusat / Admin Gudang. */
export async function aturQris(outletId: string, d: { url: string | null; payload: string | null; nama: string; dinamis: boolean; penyedia: string; merchant: string }): Promise<Result> {
  const r = (await getSession())?.active?.role;
  if (!r || !["owner", "admin_pusat", "admin_gudang"].includes(r)) return { error: "Hanya Owner / Admin Pusat / Admin Gudang." };
  const payload = d.payload?.trim() || null;
  if (payload) {
    const i = cekQris(payload);
    if (!i.valid) return { error: `Kode QRIS tidak valid (${i.alasan}).` };
  }
  if (!d.dinamis && !payload && !d.url) return { error: "Unggah gambar QRIS atau tempel kode QRIS." };
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("atur_qris_integrasi", { p_penyedia: d.penyedia, p_merchant: d.merchant, p_outlet: outletId, p_url: d.url ?? "", p_payload: payload ?? "", p_nama: d.nama, p_dinamis: d.dinamis });
  if (error) return { error: error.message.replace(/^.*?ERROR:\s*/, "") };
  revalidatePath("/pengaturan/qris");
  revalidatePath("/kasir/pos");
  return { ok: d.dinamis ? "Mode dinamis disimpan. Menunggu konfigurasi penyedia pembayaran." : "QRIS statis outlet disimpan." };
}

export async function hapusQris(outletId: string): Promise<Result> {
  const r = (await getSession())?.active?.role;
  if (!r || !["owner", "admin_pusat", "admin_gudang"].includes(r)) return { error: "Hanya Owner / Admin Pusat / Admin Gudang." };
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("atur_qris_integrasi", { p_penyedia: "", p_merchant: "", p_outlet: outletId, p_url: "", p_payload: "", p_nama: "", p_dinamis: false });
  if (error) return { error: error.message.replace(/^.*?ERROR:\s*/, "") };
  revalidatePath("/pengaturan/qris");
  revalidatePath("/kasir/pos");
  return { ok: "QRIS outlet dihapus." };
}
