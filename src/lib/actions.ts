"use server";

import { redirect } from "next/navigation";
import { PERAN_DAFTAR } from "./roles";
import { getSession, setActive } from "./session";
import { supabaseServer } from "./supabase/server";

export type LoginState = { error?: string };

/** Setelah login: langsung ke dashboard sesuai peran (pilih dulu bila punya beberapa peran). */
async function setelahLogin(): Promise<never> {
  await setActive(null);
  const s = await getSession();
  if (!s || s.status !== "aktif" || s.assignments.length === 0) redirect("/menunggu");
  redirect(s.active ? "/dashboard" : "/pilih-peran");
}

export async function loginAction(_: LoginState, form: FormData): Promise<LoginState> {
  const mode = form.get("mode");
  const login = String(form.get("login") ?? "").trim().toLowerCase();
  const secret = String(form.get("secret") ?? "");
  const supabase = await supabaseServer();

  // Kasir/barista: kode staf + PIN. PIN digabung rahasia server agar tidak bisa
  // ditebak langsung ke API Supabase tanpa lewat aplikasi (AKS-02).
  const { error } =
    mode === "pin"
      ? await supabase.auth.signInWithPassword({
          email: `${login}@pin.matur.id`,
          password: `pin:${secret}:${process.env.PIN_PEPPER}`,
        })
      : await supabase.auth.signInWithPassword({ email: login, password: secret });
  if (error) return { error: mode === "pin" ? "Kode staf atau PIN salah." : "Email atau password salah." };
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

export type DaftarState = { error?: string; ok?: boolean };

// Daftar akun mandiri: status "menunggu" sampai di-ACC Owner/Admin Pusat
export async function daftarAction(_: DaftarState, form: FormData): Promise<DaftarState> {
  const peran = String(form.get("peran") ?? "");
  if (!PERAN_DAFTAR.some(([r]) => r === peran)) return { error: "Pilih peran yang diajukan." };
  const password = String(form.get("password") ?? "");
  if (password !== String(form.get("password2") ?? "")) return { error: "Konfirmasi password tidak sama." };
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("daftar_akun", {
    p_nama: String(form.get("nama") ?? ""),
    p_email: String(form.get("email") ?? ""),
    p_hp: String(form.get("hp") ?? ""),
    p_password: password,
    p_permintaan: { peran, outlet: String(form.get("outlet") ?? ""), catatan: String(form.get("catatan") ?? "") },
  });
  if (error) return { error: error.message };
  return { ok: true };
}

export async function chooseAssignment(form: FormData) {
  const s = await getSession();
  if (!s) redirect("/login");
  const role = String(form.get("role"));
  const outletId = form.get("outletId") ? String(form.get("outletId")) : null;
  const ok = s.assignments.some((a) => a.role === role && a.outletId === outletId);
  await setActive(ok ? { role, outletId } : null);
  redirect(ok ? "/dashboard" : "/pilih-peran");
}

export async function logoutAction() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  await setActive(null);
  redirect("/login");
}
