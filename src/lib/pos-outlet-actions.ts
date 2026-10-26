"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "./supabase/server";
import { POS_DEVICE, POS_UNLOCK } from "./pos-tim";
import { COOKIE_SESI } from "./shift";
import type { PosHasil } from "./pos-tim-actions";
export async function aturAksesOutlet(
  outlet: string,
  username: string,
  password: string,
  aktif: boolean,
  baru: boolean,
  versi: string | null,
): Promise<PosHasil> {
  const db = await supabaseServer();
  const { error } = await db.rpc("simpan_akses_pos_outlet", {
    p_outlet: outlet,
    p_username: username,
    p_password: password,
    p_aktif: aktif,
    p_baru: baru,
    p_versi: versi,
  });
  if (error) return { error: error.message };
  revalidatePath("/pengaturan/pos");
  return { ok: "Akses POS outlet disimpan. Password akun pribadi tetap sama." };
}
export async function hapusAksesOutlet(
  outlet: string,
  versi: string,
): Promise<PosHasil> {
  const db = await supabaseServer();
  const { error } = await db.rpc("hapus_akses_pos_outlet", {
    p_outlet: outlet,
    p_versi: versi,
  });
  if (error) return { error: error.message };
  revalidatePath("/pengaturan/pos");
  revalidatePath("/pos");
  return {
    ok: "Akses POS outlet dihapus. Riwayat transaksi, kas, dan serah terima tetap tersimpan.",
  };
}
export async function tutupKasOutlet(
  id: string,
  aktual: number,
  catatan: string,
  pending: string[],
): Promise<PosHasil> {
  const c = await cookies();
  const db = await supabaseServer();
  const { error, data } = await db.rpc("tutup_kas_outlet", {
    p_sesi: id,
    p_device: c.get(POS_DEVICE)?.value ?? "",
    p_kode: "",
    p_pin: c.get(POS_UNLOCK)?.value ?? "",
    p_aktual: aktual,
    p_catatan: catatan,
    p_pending: pending,
  });
  if (error || data?.error) return { error: error?.message ?? data.error };
  c.delete(POS_UNLOCK);
  c.delete(COOKIE_SESI);
  revalidatePath("/kasir");
  return {
    ok: "Kas harian ditutup. Rekap tetap sementara bila masih ada antrean offline.",
  };
}

export async function lihatSandiOutlet(outlet: string): Promise<{
  sandi?: string;
  belum_tersimpan?: boolean;
  error?: string;
}> {
  const db = await supabaseServer();
  const { data, error } = await db.rpc("lihat_sandi_pos_outlet", {
    p_outlet: outlet,
  });
  if (error) return { error: error.message };
  return data ?? { error: "Sandi belum dapat ditampilkan." };
}
export async function simpanSandiLamaOutlet(
  outlet: string,
  sandi: string,
  versi: string | null,
): Promise<PosHasil> {
  const db = await supabaseServer();
  const { data, error } = await db.rpc("simpan_sandi_pos_lama", {
    p_outlet: outlet,
    p_sandi: sandi,
    p_versi: versi,
  });
  if (error || data?.error) return { error: error?.message ?? data.error };
  return { ok: "Sandi yang sama sudah tersimpan." };
}
