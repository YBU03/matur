"use server";

import { revalidatePath } from "next/cache";
import type { Role } from "./roles";
import { ROLES } from "./roles";
import { getSession } from "./session";
import { supabaseServer } from "./supabase/server";

export type Result = { error?: string; ok?: string };

const PIN_ROLES: Role[] = ["kasir", "barista"];
const pinPassword = (pin: string) => `pin:${pin}:${process.env.PIN_PEPPER}`;

/** Akun PIN memakai kode staf → email internal kode@pin.matur.id */
function loginEmail(role: Role, login: string) {
  const l = login.trim().toLowerCase();
  return PIN_ROLES.includes(role) ? `${l.replace(/[^a-z0-9._-]/g, "")}@pin.matur.id` : l;
}

function checkSecret(role: Role, secret: string): string | null {
  if (PIN_ROLES.includes(role)) return /^\d{4,6}$/.test(secret) ? null : "PIN harus 4–6 digit angka";
  return secret.length >= 8 ? null : "Password minimal 8 karakter";
}

export async function createUser(_: Result, form: FormData): Promise<Result> {
  if (!(await getSession())?.active) return { error: "Tidak diizinkan." };
  const role = String(form.get("role")) as Role;
  const nama = String(form.get("nama") ?? "").trim();
  const login = String(form.get("login") ?? "");
  const secret = String(form.get("secret") ?? "");
  const outlet = String(form.get("outlet") ?? "") || null;
  if (!ROLES[role] || !nama || !login) return { error: "Lengkapi nama, peran, dan email/kode." };
  if (!ROLES[role].allOutlets && !outlet) return { error: "Peran ini wajib memilih outlet." };
  const bad = checkSecret(role, secret);
  if (bad) return { error: bad };

  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("buat_pengguna", {
    p_email: loginEmail(role, login),
    p_password: PIN_ROLES.includes(role) ? pinPassword(secret) : secret,
    p_nama: nama,
    p_peran: role,
    p_outlet: ROLES[role].allOutlets ? null : outlet,
  });
  if (error) return { error: error.message };
  revalidatePath("/pengguna");
  return { ok: `Akun ${nama} dibuat.` };
}

export async function resetSecret(uid: string, role: Role, secret: string): Promise<Result> {
  const bad = checkSecret(role, secret);
  if (bad) return { error: bad };
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("atur_password", {
    p_uid: uid,
    p_password: PIN_ROLES.includes(role) ? pinPassword(secret) : secret,
  });
  return error ? { error: error.message } : { ok: PIN_ROLES.includes(role) ? "PIN diperbarui." : "Password diperbarui." };
}

export async function addAssignment(uid: string, role: Role, outlet: string | null): Promise<Result> {
  if (!ROLES[role].allOutlets && !outlet) return { error: "Pilih outlet." };
  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("penugasan")
    .insert({ pengguna_id: uid, peran: role, outlet_id: ROLES[role].allOutlets ? null : outlet });
  if (error) return { error: error.message.includes("row-level") ? "Hanya owner yang bisa mengatur peran." : error.message };
  revalidatePath("/pengguna");
  return { ok: "Peran ditambahkan." };
}

export async function removeAssignment(id: string): Promise<Result> {
  const supabase = await supabaseServer();
  const { error, count } = await supabase.from("penugasan").delete({ count: "exact" }).eq("id", id);
  if (error || !count) return { error: "Gagal mencabut peran (hanya owner)." };
  revalidatePath("/pengguna");
  return { ok: "Peran dicabut." };
}

// ACC pendaftar: tetapkan peran + outlet (outlet wajib untuk peran outlet/mitra)
export async function approveUser(uid: string, role: Role, outlet: string | null): Promise<Result> {
  if (!ROLES[role]) return { error: "Peran tidak valid." };
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("setujui_pengguna", { p_uid: uid, p_peran: role, p_outlet: ROLES[role].allOutlets ? null : outlet });
  if (error) return { error: error.message };
  revalidatePath("/pengguna");
  return { ok: `Disetujui sebagai ${ROLES[role].label}.` };
}

export async function rejectUser(uid: string): Promise<Result> {
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("tolak_pengguna", { p_uid: uid });
  if (error) return { error: error.message };
  revalidatePath("/pengguna");
  return { ok: "Pendaftaran ditolak." };
}

export async function setUserStatus(uid: string, status: "aktif" | "nonaktif"): Promise<Result> {
  const s = await getSession();
  if (s?.userId === uid) return { error: "Tidak bisa menonaktifkan akun sendiri." };
  const supabase = await supabaseServer();
  const { error, count } = await supabase.from("pengguna").update({ status }, { count: "exact" }).eq("id", uid);
  if (error || !count) return { error: "Tidak diizinkan mengubah status akun ini." };
  revalidatePath("/pengguna");
  return { ok: status === "aktif" ? "Akun diaktifkan." : "Akun dinonaktifkan." };
}

// Hapus pengguna (Owner): permanen bila tanpa riwayat, selain itu diarsipkan (login mati, riwayat tetap)
export async function hapusPengguna(uid: string): Promise<Result> {
  const s = await getSession();
  if (s?.active?.role !== "owner") return { error: "Hanya Owner yang bisa menghapus pengguna." };
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("hapus_pengguna", { p_uid: uid });
  if (error)
    return { error: error.message.includes("function") && error.message.includes("does not exist") ? "Fitur hapus belum aktif di database (jalankan 0023_hapus_pengguna.sql)." : error.message };
  revalidatePath("/pengguna");
  return { ok: data === "dihapus" ? "Pengguna dihapus permanen." : "Pengguna dihapus. Riwayat aktivitasnya tetap disimpan untuk catatan." };
}
