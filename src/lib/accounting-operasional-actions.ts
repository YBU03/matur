"use server";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "./supabase/server";
import { getSession } from "./session";
export async function muatBahanBelanja() {
  const s = await getSession();
  if (!s?.active) return { error: "Silakan login." };
  const db = await supabaseServer();
  const { data, error } = await db
    .from("bahan")
    .select("id,nama,satuan_pakai")
    .eq("mode", "asli")
    .is("deleted_at", null)
    .order("nama")
    .limit(1000);
  return error ? { error: error.message } : { data: data ?? [] };
}
export async function revisiAktual(p: {
  sesi_id: string;
  aktual: number;
  sebelum: number | null;
  alasan: string;
}) {
  const db = await supabaseServer();
  const { error } = await db.rpc("revisi_aktual_kas", { p });
  if (error) return { error: error.message };
  for (const path of ["/catatan-harian", "/kasir/shift", "/pengaturan/pos"])
    revalidatePath(path);
  return { ok: "Aktual direvisi; selisih dan rekap diperbarui." };
}
export async function terimaBelanja(p: {
  id: string;
  items: { bahan_id: string; qty: number }[];
  catatan: string;
}) {
  const db = await supabaseServer();
  const { error } = await db.rpc("terima_belanja_bahan", { p });
  if (error) return { error: error.message };
  for (const path of [
    "/kasir/shift",
    "/catatan-harian",
    "/karyawan/kas",
    "/persediaan",
    "/kasir/stok",
    "/karyawan/stok",
  ])
    revalidatePath(path);
  return {
    ok: "Penerimaan dicatat. Stok bertambah sesuai jumlah diterima; biaya tidak dicatat ulang.",
  };
}
