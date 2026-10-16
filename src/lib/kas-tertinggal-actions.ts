"use server";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "./supabase/server";

// Owner / SPV outlet / Admin Gudang menutup kas POS yang tersangkut (lewat batas shift, tablet tidak bisa menutup).
export async function tutupKasTertinggal(
  id: string,
  aktual: number,
  alasan: string,
): Promise<{ error?: string; ok?: string }> {
  const db = await supabaseServer();
  const { data, error } = await db.rpc("tutup_kas_tertinggal", {
    p_sesi: id,
    p_aktual: Math.round(aktual),
    p_alasan: alasan,
  });
  if (error) return { error: error.message };
  for (const p of [
    "/pengaturan/pos",
    "/dashboard",
    "/catatan-harian",
    "/setoran",
  ])
    revalidatePath(p);
  const selisih = Number((data as { selisih?: number } | null)?.selisih ?? 0);
  return {
    ok:
      selisih === 0
        ? "Kas ditutup, uang sesuai."
        : `Kas ditutup dengan selisih ${selisih > 0 ? "+" : ""}${selisih.toLocaleString("id-ID")}.`,
  };
}
