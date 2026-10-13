"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "./supabase/server";

// Simpan hasil hitung fisik (satuan pakai). Stok outlet disesuaikan dan nilai persediaan tersimpan.
export async function simpanOpname(outletId: string, tanggal: string, items: { bahan_id: string; qty_fisik: number }[], catatan: string): Promise<{ error?: string; ok?: string }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) return { error: "Tanggal tidak valid." };
  const rows = items.filter((i) => Number.isFinite(i.qty_fisik) && i.qty_fisik >= 0);
  if (!rows.length) return { error: "Isi minimal satu hasil hitung." };
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("simpan_opname", { p_outlet: outletId, p_tanggal: tanggal, p_items: rows, p_catatan: catatan });
  if (error) return { error: error.message };
  revalidatePath("/stok");
  return { ok: `Opname tersimpan (${rows.length} bahan). Stok outlet sudah disesuaikan.` };
}
