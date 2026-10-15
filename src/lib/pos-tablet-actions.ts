"use server";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { POS_DEVICE } from "./pos-tim";
import { setActive } from "./session";
import { supabaseServer } from "./supabase/server";

// Pemasangan tablet POS outlet (sekali, oleh Owner/HRD/Admin Gudang atau SPV outlet).
// Kredensial admin hanya dipakai di klien sementara di server, tidak disimpan di tablet.
// Tablet lalu masuk dengan "akun tablet" tersembunyi berpassword acak yang tidak pernah disimpan.

export type OutletPasang = { id: string; nama: string };
export type HasilPasang = {
  error?: string;
  outlets?: OutletPasang[];
  ok?: string;
};

const opsiCookie = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

async function masukAdmin(email: string, password: string) {
  const db = createClient(
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
  const { error } = await db.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) return { error: "Email/password admin salah." as const };
  return { db };
}

/** Langkah 1: periksa akun admin/SPV dan ambil outlet yang boleh dipasangi tablet. */
export async function cekAdminTablet(
  email: string,
  password: string,
): Promise<HasilPasang> {
  const m = await masukAdmin(email, password);
  if (!m.db) return { error: m.error };
  try {
    const { data, error } = await m.db.rpc("outlet_pasang_tablet");
    if (error) return { error: error.message };
    const outlets = (data ?? []) as OutletPasang[];
    if (!outlets.length)
      return {
        error:
          "Akun ini tidak berwenang memasangkan tablet. Gunakan akun Owner/HRD/Admin Gudang atau SPV outlet.",
      };
    return { outlets };
  } finally {
    await m.db.auth.signOut({ scope: "local" });
  }
}

/** Langkah 2: buat akun tablet + perangkat aktif, lalu tablet ini masuk dengan akun tersebut. */
export async function pasangTablet(
  email: string,
  password: string,
  outlet: string,
  nama: string,
  mode: "kasir" | "antrean",
): Promise<HasilPasang> {
  const m = await masukAdmin(email, password);
  if (!m.db) return { error: m.error };
  const rahasia = randomBytes(32).toString("hex");
  const sandi = randomBytes(24).toString("base64url");
  let akun: string;
  try {
    const { data, error } = await m.db.rpc("pasang_tablet_pos", {
      p_outlet: outlet,
      p_nama: nama,
      p_mode: mode,
      p_rahasia: rahasia,
      p_password: sandi,
    });
    if (error) return { error: error.message };
    akun = (data as { email: string }).email;
  } finally {
    await m.db.auth.signOut({ scope: "local" });
  }
  const db = await supabaseServer();
  await db.auth.signOut({ scope: "local" });
  const { error } = await db.auth.signInWithPassword({
    email: akun,
    password: sandi,
  });
  if (error)
    return {
      error:
        "Tablet terdaftar tetapi gagal masuk. Cabut tablet di POS Tim lalu pasangkan ulang.",
    };
  const c = await cookies();
  c.set(POS_DEVICE, rahasia, { ...opsiCookie, maxAge: 60 * 60 * 24 * 400 });
  c.delete("matur_pos_unlock");
  c.delete("pos_sesi");
  await setActive({ role: "tablet", outletId: outlet });
  return { ok: "Tablet terpasang." };
}
