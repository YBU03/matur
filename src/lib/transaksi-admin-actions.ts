"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "./session";
import { supabaseServer } from "./supabase/server";

export type Hasil = { error?: string; ok?: string };
const PENGOREKSI_TRANSAKSI = ["owner", "admin_pusat", "finance"];

async function boleh() {
  const r = (await getSession())?.active?.role;
  return !!r && PENGOREKSI_TRANSAKSI.includes(r);
}
const bersih = (m: string) => m.replace(/^.*?ERROR:\s*/, "");
function segarkan() {
  revalidatePath("/laporan-pos", "layout");
  revalidatePath("/catatan-harian");
  revalidatePath("/dashboard");
  revalidatePath("/kasir/riwayat");
}

/** Pindahkan transaksi ke tempat sampah (bisa dipulihkan). Omzet, kas & stok menyesuaikan. */
export async function hapusTransaksi(id: string, alasan: string): Promise<Hasil> {
  if (!(await boleh())) return { error: "Hanya Owner/Admin Pusat/Finance." };
  const db = await supabaseServer();
  const { data, error } = await db.rpc("hapus_transaksi", { p_id: id, p_alasan: alasan });
  if (error) return { error: bersih(error.message) };
  segarkan();
  return { ok: (data as { ok?: string })?.ok ?? "Dipindah ke tempat sampah." };
}

export async function pulihkanTransaksi(id: string): Promise<Hasil> {
  if (!(await boleh())) return { error: "Hanya Owner/Admin Pusat/Finance." };
  const db = await supabaseServer();
  const { data, error } = await db.rpc("pulihkan_transaksi", { p_id: id });
  if (error) return { error: bersih(error.message) };
  segarkan();
  return { ok: (data as { ok?: string })?.ok ?? "Dipulihkan." };
}

/** Koreksi salah klik: kanal penjualan dan/atau metode bayar (satu pembayaran). */
export async function koreksiTransaksi(id: string, d: { kanal: string | null; metode: string | null; alasan: string }): Promise<Hasil> {
  if (!(await boleh())) return { error: "Hanya Owner/Admin Pusat/Finance." };
  const db = await supabaseServer();
  const { data, error } = await db.rpc("koreksi_transaksi", { p_id: id, p_kanal: d.kanal, p_metode: d.metode, p_alasan: d.alasan });
  if (error) return { error: bersih(error.message) };
  segarkan();
  return { ok: (data as { ok?: string })?.ok ?? "Dikoreksi." };
}
