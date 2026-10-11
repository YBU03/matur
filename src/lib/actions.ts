"use server";

import { redirect } from "next/navigation";
import { getSession, setActive } from "./session";
import { supabaseServer } from "./supabase/server";

export type LoginState = { error?: string };

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

  await setActive(null);
  const s = await getSession();
  redirect(s?.active ? "/dashboard" : "/pilih-peran");
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
