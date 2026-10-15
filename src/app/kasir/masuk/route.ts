import { NextResponse, type NextRequest } from "next/server";
import { BISA_JUAL, POS_ROLES, type Role } from "@/lib/roles";
import { getSession, setActive } from "@/lib/session";

// Tetapkan peran & outlet POS yang aktif, lalu buka layar kasir/antrean.
export async function GET(req: NextRequest) {
  const role = req.nextUrl.searchParams.get("role") as Role | null;
  const outletId = req.nextUrl.searchParams.get("outlet");
  const s = await getSession();
  const ok = !!s && !!role && POS_ROLES.includes(role) && s.assignments.some((a) => a.role === role && a.outletId === outletId);
  const staf = req.nextUrl.searchParams.get("ke") === "staf";
  if (!ok) return NextResponse.redirect(new URL(staf ? "/staf/pilih" : "/pos", req.url));
  await setActive({ role: role!, outletId });
  if (staf) return NextResponse.redirect(new URL("/staf", req.url));
  return NextResponse.redirect(new URL(BISA_JUAL.includes(role!) ? "/kasir/pos" : "/kasir/antrean", req.url));
}
