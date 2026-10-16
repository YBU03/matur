"use server";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { POS_DEVICE, POS_UNLOCK, type TimStatus } from "./pos-tim";
import { setActive } from "./session";
import { COOKIE_SESI } from "./shift";
import { supabaseServer } from "./supabase/server";

// Masuk tablet POS di /pos langsung dengan kode staf + PIN (tanpa email/password, tanpa admin).
// Sistem memakai "akun tablet" tersembunyi per perangkat; passwordnya acak dan diganti setiap kali masuk.

export type OutletPos = { id: string; nama: string };
export type HasilMasuk = {
  error?: string;
  pilih?: OutletPos[];
  ok?: boolean;
  /** shift belum dibuka: isi modal kas lalu buka shift tim */
  modal?: {
    shift: string;
    saya: string;
    tim: { id: string; nama: string; kasir: boolean }[];
  };
};

const opsiCookie = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export async function masukPos(
  kode: string,
  pin: string,
  outlet: string | null,
): Promise<HasilMasuk> {
  const c = await cookies();
  const rahasia = c.get(POS_DEVICE)?.value ?? randomBytes(32).toString("hex");
  const sandi = randomBytes(24).toString("base64url");
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
  const { data, error } = await anon.rpc("masuk_pos_tablet", {
    p_kode: kode,
    p_pin: pin,
    p_outlet: outlet,
    p_rahasia: rahasia,
    p_password: sandi,
  });
  if (error) return { error: error.message };
  const r = data as {
    error?: string;
    pilih?: OutletPos[];
    email?: string;
    outlet_id?: string;
    uid?: string;
  };
  if (r.error) return { error: r.error };
  if (r.pilih) return { pilih: r.pilih };

  const db = await supabaseServer();
  await db.auth.signOut({ scope: "local" });
  const masuk = await db.auth.signInWithPassword({
    email: r.email!,
    password: sandi,
  });
  if (masuk.error) return { error: "Gagal masuk ke tablet. Coba lagi." };
  c.set(POS_DEVICE, rahasia, { ...opsiCookie, maxAge: 60 * 60 * 24 * 400 });
  c.delete(POS_UNLOCK);
  c.delete(COOKIE_SESI);
  await setActive({ role: "tablet", outletId: r.outlet_id! });

  // Belum ada shift: tampilkan pop-up modal kas (tanpa mengetik ulang kode/PIN).
  const st = await db.rpc("status_pos_tim", {
    p_outlet: r.outlet_id,
    p_device: rahasia,
    p_token: "",
    p_perbarui: false,
  });
  const status = st.data as TimStatus | null;
  if (status && !status.sesi) {
    const saya = status.roster.find((x) => x.id === r.uid);
    if (!saya)
      return {
        error:
          "Kamu belum Clock In untuk shift hari ini. Absen dulu di HP (menu Absen), lalu masuk lagi.",
      };
    if (!saya.kasir)
      return {
        error:
          "Shift belum dibuka. Pembuka shift harus anggota yang punya akses kasir.",
      };
    return {
      modal: {
        shift: `${saya.shift} · ${saya.tanggal}`,
        saya: saya.id,
        tim: status.roster
          .filter(
            (x) => x.shift_id === saya.shift_id && x.tanggal === saya.tanggal,
          )
          .map((x) => ({ id: x.id, nama: x.nama, kasir: x.kasir })),
      },
    };
  }

  // Shift tim di tablet ini masih berjalan: langsung buka kunci dengan PIN yang sama.
  const token = randomBytes(32).toString("hex");
  const buka = await db.rpc("buka_pos_tim", {
    p_outlet: r.outlet_id,
    p_device: rahasia,
    p_kode: kode,
    p_pin: pin,
    p_modal: 0,
    p_anggota: [],
    p_token: token,
  });
  const b = buka.data as { sesi_id?: string; error?: string } | null;
  if (buka.error || !b?.sesi_id)
    return { error: buka.error?.message ?? b?.error ?? "Gagal membuka POS." };
  c.set(POS_UNLOCK, token, { ...opsiCookie, maxAge: 60 * 60 * 20 });
  c.set(COOKIE_SESI, b.sesi_id, { ...opsiCookie, maxAge: 60 * 60 * 20 });
  return { ok: true };
}
