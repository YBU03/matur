"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "./supabase/server";

export type Result = { error?: string; ok?: string };

export async function simpanProfil(_: Result, form: FormData): Promise<Result> {
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("ubah_profil", { p_nama: String(form.get("nama") ?? ""), p_hp: String(form.get("hp") ?? "") });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: "Profil tersimpan." };
}

// Ganti password sendiri: password lama diperiksa dulu
export async function gantiPassword(_: Result, form: FormData): Promise<Result> {
  const lama = String(form.get("lama") ?? "");
  const baru = String(form.get("baru") ?? "");
  if (baru.length < 8) return { error: "Password baru minimal 8 karakter." };
  if (baru !== String(form.get("baru2") ?? "")) return { error: "Konfirmasi password baru tidak sama." };
  if (baru === lama) return { error: "Password baru harus berbeda dari yang lama." };
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims?.email as string | undefined;
  if (!email || email.endsWith("@pin.matur.id")) return { error: "Akun ini tidak memakai password." };
  const cek = await supabase.auth.signInWithPassword({ email, password: lama });
  if (cek.error) return { error: "Password lama salah." };
  const { error } = await supabase.auth.updateUser({ password: baru });
  if (error) return { error: "Gagal mengganti password: " + error.message };
  return { ok: "Password berhasil diganti." };
}

// Ganti PIN sendiri (akun kode staf kasir/barista): PIN lama diperiksa dulu
export async function gantiPin(_: Result, form: FormData): Promise<Result> {
  const lama = String(form.get("lama") ?? "");
  const baru = String(form.get("baru") ?? "");
  if (!/^\d{4,6}$/.test(baru)) return { error: "PIN baru harus 4–6 angka." };
  if (baru !== String(form.get("baru2") ?? "")) return { error: "Konfirmasi PIN baru tidak sama." };
  if (baru === lama) return { error: "PIN baru harus berbeda dari yang lama." };
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims?.email as string | undefined;
  if (!email?.endsWith("@pin.matur.id")) return { error: "Akun ini memakai password, bukan PIN." };
  const pin = (x: string) => `pin:${x}:${process.env.PIN_PEPPER}`;
  const cek = await supabase.auth.signInWithPassword({ email, password: pin(lama) });
  if (cek.error) return { error: "PIN lama salah." };
  const { error } = await supabase.auth.updateUser({ password: pin(baru) });
  if (error) return { error: "Gagal mengganti PIN: " + error.message };
  return { ok: "PIN berhasil diganti. Pakai PIN baru saat masuk berikutnya." };
}
