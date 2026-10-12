"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "./supabase/server";

// Koreksi stok gudang pusat secara manual (sementara, sebelum modul pembelian & opname).
// Jumlah diisi dalam satuan beli, disimpan dalam satuan pakai. Perubahan tercatat di log.
export async function koreksiStok(bahanId: string, jumlahSatuanBeli: number): Promise<{ error?: string }> {
  if (!Number.isFinite(jumlahSatuanBeli) || jumlahSatuanBeli < 0) return { error: "Jumlah tidak valid." };
  const supabase = await supabaseServer();
  const { data: b } = await supabase.from("bahan").select("konversi").eq("id", bahanId).single();
  if (!b) return { error: "Bahan tidak ditemukan." };
  const jumlah = Math.round(jumlahSatuanBeli * Number(b.konversi) * 1000) / 1000;
  const { data: ada } = await supabase.from("stok").select("id").eq("mode", "asli").is("outlet_id", null).eq("bahan_id", bahanId).maybeSingle();
  const q = ada
    ? supabase.from("stok").update({ jumlah, updated_at: new Date().toISOString() }).eq("id", ada.id)
    : supabase.from("stok").insert({ bahan_id: bahanId, outlet_id: null, jumlah });
  const { error } = await q.select("id").single();
  if (error) return { error: error.message.includes("row-level") ? "Hanya Admin Gudang/Admin Pusat yang bisa mengoreksi stok." : error.message };
  revalidatePath("/gudang/stok");
  return {};
}
