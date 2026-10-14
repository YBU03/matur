"use server";

// Mulai / tutup / serah terima shift kasir di perangkat outlet memakai PIN staf.
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getSession } from "./session";
import { COOKIE_SESI } from "./shift";
import { supabaseServer } from "./supabase/server";

type Hasil = { tunai: number; laci: number; seharusnya: number; aktual: number; selisih: number };
const rahasiaPin = (pin: string) => `pin:${pin}:${process.env.PIN_PEPPER}`;
const segarkan = () => {
  revalidatePath("/kasir/pos");
  revalidatePath("/kasir/shift");
  revalidatePath("/catatan-harian");
};
const pesan = (m: string) => m.replace(/^.*?ERROR:\s*/, "");

async function simpanCookie(id: string | null) {
  const c = await cookies();
  if (id) c.set(COOKIE_SESI, id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 20 });
  else c.delete(COOKIE_SESI);
}

/** Staf memulai (atau melanjutkan) shift-nya di perangkat ini dengan PIN. */
export async function mulaiShiftPin(uid: string, pin: string, modal: number): Promise<{ error?: string }> {
  const s = await getSession();
  const outlet = s?.active?.outletId;
  if (!s || !outlet) return { error: "Pilih outlet terlebih dahulu." };
  if (!/^\d{4,6}$/.test(pin)) return { error: "PIN 4–6 digit angka." };
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("mulai_shift_pin", { p_outlet: outlet, p_uid: uid, p_rahasia: rahasiaPin(pin), p_modal: Math.max(Math.round(modal) || 0, 0) });
  if (error) return { error: pesan(error.message) };
  if (!data) return { error: "PIN salah." };
  await simpanCookie(data as string);
  segarkan();
  return {};
}

/** Akun yang login memulai shift atas namanya sendiri (cara lama). */
export async function mulaiShiftSaya(modal: number): Promise<{ error?: string }> {
  const s = await getSession();
  const outlet = s?.active?.outletId;
  if (!s || !outlet) return { error: "Pilih outlet terlebih dahulu." };
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("buka_sesi_kas", { p_outlet: outlet, p_modal: Math.max(Math.round(modal) || 0, 0) });
  if (error) return { error: pesan(error.message) };
  await simpanCookie(data as string);
  segarkan();
  return {};
}

/** Lepas shift dari perangkat tanpa menutupnya (mis. pindah ke perangkat lain). */
export async function lepasShift(): Promise<void> {
  await simpanCookie(null);
  segarkan();
}

/** Tutup shift dengan cocok kas. PIN pemilik shift wajib bila yang login bukan dia (SPV tidak perlu). */
export async function tutupShiftPin(sesiId: string, pin: string, aktual: number): Promise<{ error?: string; ok?: string; hasil?: Hasil }> {
  if (!(aktual >= 0)) return { error: "Isi jumlah uang tunai yang disetor." };
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("tutup_shift_pin", { p_sesi: sesiId, p_rahasia: pin ? rahasiaPin(pin) : "", p_aktual: Math.round(aktual) });
  if (error) return { error: pesan(error.message) };
  const h = data as Hasil & { error?: string };
  if (h.error) return { error: h.error };
  await simpanCookie(null);
  segarkan();
  return { ok: "Shift ditutup. Kasir berikutnya bisa mulai shift dengan PIN-nya.", hasil: h };
}
