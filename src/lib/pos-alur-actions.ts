"use server";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { POS_UNLOCK } from "./pos-tim";
import { revalidatePath } from "next/cache";
import { getSession } from "./session";
import { buktiTablet } from "./pos-tim";
import { supabaseServer } from "./supabase/server";
import type { LaporanShift } from "./pos-alur";
export async function aturAlurShift(
  outlet: string,
  aktif: boolean,
  pin: string,
  versi: number,
) {
  const db = await supabaseServer();
  const { error } = await db.rpc("atur_alur_shift_pos", {
    p_outlet: outlet,
    p_aktif: aktif,
    p_pin: pin,
    p_versi: versi,
  });
  if (error) return { error: error.message };
  revalidatePath("/pengaturan/pos");
  return {
    ok: "Pengaturan tersimpan. Berlaku mulai kas berikutnya; kas berjalan tetap dilanjutkan.",
  };
}
export async function prosesAlurShift(p: Record<string, unknown>) {
  const s = await getSession();
  if (s?.active?.role !== "tablet" || !s.active.outletId)
    return { error: "Masuk dengan akun outlet dahulu." };
  const b = await buktiTablet();
  const db = await supabaseServer();
  const token = ["mulai", "lanjut"].includes(String(p.aksi))
    ? randomBytes(32).toString("hex")
    : b.token;
  const { data, error } = await db.rpc("proses_alur_shift_pos", {
    p_outlet: s.active.outletId,
    p_device: b.device,
    p_token: token,
    p,
  });
  if (error || data?.error) return { error: error?.message ?? data.error };
  if (token !== b.token)
    (await cookies()).set(POS_UNLOCK, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  revalidatePath("/kasir");
  return { ok: "Tersimpan." };
}
export async function ambilLaporanShift(
  sesi: string,
): Promise<{ data?: LaporanShift; error?: string }> {
  const s = await getSession();
  if (s?.active?.role !== "tablet" || !s.active.outletId)
    return { error: "Masuk dengan akun outlet dahulu." };
  const b = await buktiTablet();
  const db = await supabaseServer();
  const { data, error } = await db.rpc("laporan_alur_shift_pos", {
    p_outlet: s.active.outletId,
    p_device: b.device,
    p_sesi: sesi,
  });
  return error ? { error: error.message } : { data: data as LaporanShift };
}
export async function riwayatAlurShift(outlet: string) {
  const b = await buktiTablet();
  const db = await supabaseServer();
  const { data, error } = await db.rpc("riwayat_alur_shift_pos", {
    p_outlet: outlet,
    p_device: b.device,
  });
  return error
    ? { error: error.message }
    : {
        data: data as {
          id: string;
          tanggal_shift: string;
          dibuka_at: string;
          ditutup_at: string | null;
          fisik_akhir: number | null;
          selisih: number | null;
        }[],
      };
}
export async function laporanAlurOutlet(
  outlet: string,
  sesi: string,
): Promise<{ data?: LaporanShift; error?: string }> {
  const b = await buktiTablet();
  const db = await supabaseServer();
  const { data, error } = await db.rpc("laporan_alur_shift_pos", {
    p_outlet: outlet,
    p_device: b.device,
    p_sesi: sesi,
  });
  return error ? { error: error.message } : { data: data as LaporanShift };
}
