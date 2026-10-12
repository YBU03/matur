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
