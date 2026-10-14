"use server";

// HRD: satu data karyawan = satu akun login (email & password untuk absen/HP) + PIN (mulai shift di POS outlet).
import { revalidatePath } from "next/cache";
import { getSession } from "./session";
import { supabaseServer } from "./supabase/server";

export type Result = { error?: string; ok?: string };
const rahasiaPin = (pin: string) => `pin:${pin}:${process.env.PIN_PEPPER}`;
const pesan = (m: string) => m.replace(/^.*?ERROR:\s*/, "");
const PERAN = ["kasir", "barista", "spv"] as const;

async function bolehHrd() {
  const r = (await getSession())?.active?.role;
  return r === "owner" || r === "hrd";
}
const segarkan = () => {
  revalidatePath("/master/karyawan");
  revalidatePath("/pengguna");
};

export async function buatAkunKaryawan(d: { karyawanId: string; email: string; password: string; pin: string; peran: string; outletId: string }): Promise<Result> {
  if (!(await bolehHrd())) return { error: "Hanya HRD/Owner." };
  const email = d.email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Email tidak valid." };
  if (d.password.length < 8) return { error: "Password minimal 8 karakter." };
  if (!/^\d{4,6}$/.test(d.pin)) return { error: "PIN harus 4–6 digit angka." };
  if (!PERAN.includes(d.peran as (typeof PERAN)[number])) return { error: "Pilih peran kasir, barista, atau SPV." };
  if (!d.outletId) return { error: "Karyawan belum punya outlet utama. Isi dulu di data karyawan." };
  const supabase = await supabaseServer();
  const { data: k } = await supabase.from("karyawan").select("nama, pengguna_id").eq("id", d.karyawanId).single();
  if (!k) return { error: "Karyawan tidak ditemukan." };
  if (k.pengguna_id) return { error: "Karyawan ini sudah punya akun." };
  const { data: uid, error } = await supabase.rpc("buat_pengguna", { p_email: email, p_password: d.password, p_nama: k.nama, p_peran: d.peran, p_outlet: d.outletId });
  if (error) return { error: pesan(error.message) };
  const [{ error: e1 }, { error: e2 }] = await Promise.all([
    supabase.rpc("atur_pin", { p_uid: uid, p_rahasia: rahasiaPin(d.pin) }),
    supabase.rpc("hubungkan_akun_karyawan", { p_karyawan: d.karyawanId, p_uid: uid }),
  ]);
  if (e1 || e2) return { error: `Akun dibuat, tapi ${pesan((e1 ?? e2)!.message)}` };
  segarkan();
  return { ok: `Akun ${k.nama} dibuat. Login: ${email} · PIN shift sudah diatur.` };
}

export async function aturPinKaryawan(uid: string, pin: string): Promise<Result> {
  if (!(await bolehHrd())) return { error: "Hanya HRD/Owner." };
  if (!/^\d{4,6}$/.test(pin)) return { error: "PIN harus 4–6 digit angka." };
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("atur_pin", { p_uid: uid, p_rahasia: rahasiaPin(pin) });
  if (error) return { error: pesan(error.message) };
  segarkan();
  return { ok: "PIN shift diperbarui." };
}

export async function resetPasswordKaryawan(uid: string, password: string): Promise<Result> {
  if (!(await bolehHrd())) return { error: "Hanya HRD/Owner." };
  if (password.length < 8) return { error: "Password minimal 8 karakter." };
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("atur_password", { p_uid: uid, p_password: password });
  if (error) return { error: pesan(error.message) === "Tidak diizinkan" ? "Password akun ini hanya bisa diganti Owner." : pesan(error.message) };
  return { ok: "Password diperbarui." };
}

export async function hubungkanAkun(karyawanId: string, uid: string | null): Promise<Result> {
  if (!(await bolehHrd())) return { error: "Hanya HRD/Owner." };
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("hubungkan_akun_karyawan", { p_karyawan: karyawanId, p_uid: uid });
  if (error) return { error: pesan(error.message) };
  segarkan();
  return { ok: uid ? "Akun dihubungkan ke karyawan." : "Akun dilepas dari karyawan." };
}
