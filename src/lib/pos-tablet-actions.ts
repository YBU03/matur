"use server";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { POS_DEVICE, POS_UNLOCK } from "./pos-tim";
import { setActive } from "./session";
import { COOKIE_SESI } from "./shift";
import { supabaseServer } from "./supabase/server";

// Authenticate the shared outlet credential, then provision a separate hidden Auth identity for this browser.
export type HasilMasuk = { error?: string; ok?: boolean };

const opsiCookie = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export async function masukPos(
  username: string,
  password: string,
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
  const { data, error } = await anon.rpc("masuk_pos_outlet", {
    p_username: username,
    p_sandi: password,
    p_rahasia: rahasia,
    p_password: sandi,
  });
  if (error) return { error: error.message };
  const r = data as {
    error?: string;
    email?: string;
    outlet_id?: string;
  };
  if (r.error) return { error: r.error };

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

  return { ok: true };
}
