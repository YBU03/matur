import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { USERS, type Assignment, type DemoUser } from "./demo-data";

// Sesi sementara (Tahap 1) berupa cookie bertanda tangan HMAC.
// Tahap 2 diganti Supabase Auth + RLS.

const COOKIE = "matur_session";
const SECRET = process.env.SESSION_SECRET ?? "dev-only-secret-ganti-di-produksi";

type Payload = { uid: string; active: Assignment | null };
export type Session = { user: DemoUser; active: Assignment | null };

const sign = (data: string) => createHmac("sha256", SECRET).update(data).digest("base64url");

export async function getSession(): Promise<Session | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [data, sig] = raw.split(".");
  if (!data || !sig) return null;
  const expected = Buffer.from(sign(data));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  const p = JSON.parse(Buffer.from(data, "base64url").toString()) as Payload;
  const user = USERS.find((u) => u.id === p.uid);
  if (!user) return null;
  // pastikan penugasan aktif memang milik pengguna (AKS-03)
  const active =
    p.active && user.assignments.some((a) => a.role === p.active!.role && a.outletId === p.active!.outletId)
      ? p.active
      : null;
  return { user, active };
}

export async function setSession(p: Payload) {
  const data = Buffer.from(JSON.stringify(p)).toString("base64url");
  (await cookies()).set(COOKIE, `${data}.${sign(data)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}
