import "server-only";
import { redirect } from "next/navigation";
import { POS_ROLES } from "./roles";
import { getSession } from "./session";

/**
 * Sesi untuk halaman aplikasi staf. Layout & halaman dirender bersamaan, jadi setiap halaman
 * menjaga dirinya sendiri (sesi habis → login, belum memilih outlet → pilih).
 */
export async function sesiStaf() {
  const s = await getSession();
  if (!s) redirect("/staf/login");
  const a = s.active;
  if (!a?.outletId || !POS_ROLES.includes(a.role)) redirect("/staf/pilih");
  return { s, a, outlet: a.outletId };
}
