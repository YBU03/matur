"use server";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "./supabase/server";
import { getSession } from "./session";
import { POS_DEVICE, POS_UNLOCK } from "./pos-tim";
import { COOKIE_SESI } from "./shift";
import type { PosHasil } from "./pos-tim-actions";
export async function aturAksesOutlet(
  outlet: string,
  username: string,
  password: string,
  aktif: boolean,
): Promise<PosHasil> {
  const db = await supabaseServer();
  const { error } = await db.rpc("atur_akses_pos_outlet", {
    p_outlet: outlet,
    p_username: username,
    p_password: password,
    p_aktif: aktif,
  });
  if (error) return { error: error.message };
  revalidatePath("/pengaturan/pos");
  return { ok: "Akses POS outlet disimpan. Password akun pribadi tetap sama." };
}
export async function pilihPicOutlet(
  pic: string,
  modal: number | null,
  fisik: number | null,
  catatan: string,
): Promise<PosHasil> {
  const s = await getSession();
  if (s?.active?.role !== "tablet" || !s.active.outletId)
    return { error: "Masuk dengan akun POS outlet dahulu." };
  const c = await cookies();
  const token = randomBytes(32).toString("hex");
  const db = await supabaseServer();
  const { data, error } = await db.rpc("pilih_pic_pos_outlet", {
    p_outlet: s.active.outletId,
    p_device: c.get(POS_DEVICE)?.value ?? "",
    p_pic: pic,
    p_modal: modal,
    p_fisik: fisik,
    p_catatan: catatan,
    p_token: token,
  });
  if (error || data?.error) return { error: error?.message ?? data.error };
  const opts = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24,
  };
  c.set(POS_UNLOCK, token, opts);
  c.set(COOKIE_SESI, data.sesi_id, opts);
  revalidatePath("/pos");
  revalidatePath("/kasir");
  return {
    ok: "PIC dan tim shift tercatat. Modal kas tetap sama.",
    id: data.sesi_id,
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
