"use server";

import { redirect } from "next/navigation";
import { USERS } from "./demo-data";
import type { Role } from "./roles";
import { clearSession, getSession, setSession } from "./session";

export type LoginState = { error?: string };

export async function loginAction(_: LoginState, form: FormData): Promise<LoginState> {
  const mode = form.get("mode");
  const login = String(form.get("login") ?? "").trim().toLowerCase();
  const secret = String(form.get("secret") ?? "");
  const user = USERS.find((u) =>
    mode === "pin" ? u.pin && u.pin === secret && (!login || u.login === login) : u.login === login && u.password === secret,
  );
  if (!user) return { error: mode === "pin" ? "PIN tidak dikenali." : "Email/HP atau password salah." };
  // satu penugasan langsung masuk, lebih dari satu → pilih peran/outlet (AKS-01)
  const only = user.assignments.length === 1 ? user.assignments[0] : null;
  await setSession({ uid: user.id, active: only });
  redirect(only ? "/dashboard" : "/pilih-peran");
}

export async function chooseAssignment(form: FormData) {
  const s = await getSession();
  if (!s) redirect("/login");
  const role = String(form.get("role")) as Role;
  const outletId = form.get("outletId") ? String(form.get("outletId")) : null;
  const ok = s.user.assignments.some((a) => a.role === role && a.outletId === outletId);
  await setSession({ uid: s.user.id, active: ok ? { role, outletId } : null });
  redirect(ok ? "/dashboard" : "/pilih-peran");
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}
