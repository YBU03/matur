"use server";

import {cookies} from "next/headers";
import { redirect } from "next/navigation";
import { POS_ONLY } from "./roles";
import { getSession, setActive } from "./session";
import { supabaseServer } from "./supabase/server";

export type LoginState = { error?: string };

/** Setelah login: langsung ke dashboard sesuai peran (pilih dulu bila punya beberapa peran). */
async function setelahLogin(): Promise<never> {
  await setActive(null);
  const s = await getSession();
  if (!s || s.status !== "aktif" || s.assignments.length === 0) redirect("/menunggu");
  if (s.active?.role === "tablet") redirect("/pos");
  if (s.assignments.every((a) => POS_ONLY.includes(a.role))) redirect("/karyawan");
  redirect(s.active ? "/dashboard" : "/pilih-peran");
}

export async function loginAction(_: LoginState, form: FormData): Promise<LoginState> {
  const login = String(form.get("login") ?? "").trim().toLowerCase();
  const secret = String(form.get("secret") ?? "");
  const supabase = await supabaseServer();
  // login kode staf + PIN hanya di aplikasi POS (/kasir)
  const { error } = await supabase.auth.signInWithPassword({ email: login, password: secret });
  if (error) return { error: "Email atau password salah." };
  return setelahLogin();
}

// Mitra & PIC: login kode OTP via email (PRD tabel peran)
export async function otpAction(_: LoginState & { sent?: string }, form: FormData): Promise<LoginState & { sent?: string }> {
  const email = String(form.get("login") ?? "").trim().toLowerCase();
  const token = String(form.get("secret") ?? "").trim();
  const supabase = await supabaseServer();
  if (!token) {
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    if (error) return { error: "Email tidak terdaftar atau terlalu sering meminta kode. Coba lagi nanti." };
    return { sent: email };
  }
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) return { sent: email, error: "Kode salah atau kedaluwarsa." };
  return setelahLogin();
}

export type DaftarState = { error?: string };

// Daftar akun mandiri. Pendaftar pertama (belum ada Owner) otomatis menjadi Owner;
// selanjutnya status "menunggu" sampai admin menentukan peran & outlet.
export async function daftarAction(_: DaftarState, form: FormData): Promise<DaftarState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (password !== String(form.get("password2") ?? "")) return { error: "Konfirmasi password tidak sama." };
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("daftar_akun", {
    p_nama: String(form.get("nama") ?? ""),
    p_email: email,
    p_hp: String(form.get("hp") ?? ""),
    p_password: password,
    p_permintaan: { catatan: String(form.get("catatan") ?? ""), ...(form.get("staf_outlet") ? { jenis: "staf_outlet" } : {}) },
  });
  if (error) return { error: error.message };
  const { error: e2 } = await supabase.auth.signInWithPassword({ email, password });
  if (e2) redirect("/login");
  return setelahLogin();
}

export async function logoutAction() {
  const supabase = await supabaseServer();
  const c=await cookies();c.delete("matur_pos_unlock");c.delete("pos_sesi");
  await supabase.auth.signOut();
  await setActive(null);
  redirect("/login");
}

// ---------- Aplikasi POS (/kasir) ----------
export async function kasirLoginAction(_: LoginState, form: FormData): Promise<LoginState> {
  const mode = form.get("mode");
  const login = String(form.get("login") ?? "").trim().toLowerCase();
  const secret = String(form.get("secret") ?? "");
  const supabase = await supabaseServer();
  // Kode staf + PIN; PIN digabung rahasia server agar tidak bisa ditebak langsung ke API (AKS-02)
  const { error } =
    mode === "email"
      ? await supabase.auth.signInWithPassword({ email: login, password: secret })
      : await supabase.auth.signInWithPassword({ email: `${login}@pin.matur.id`, password: `pin:${secret}:${process.env.PIN_PEPPER}` });
  if (error) return { error: mode === "email" ? "Email atau password salah." : "Kode staf atau PIN salah." };
  await setActive(null);
  redirect("/kasir");
}

export async function kasirLogoutAction() {
  const supabase = await supabaseServer();
  const c=await cookies();c.delete("matur_pos_unlock");c.delete("pos_sesi");
  await supabase.auth.signOut();
  await setActive(null);
  redirect("/kasir");
}
