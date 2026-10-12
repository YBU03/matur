import { NextResponse, type NextRequest } from "next/server";
import { getSession, setActive } from "@/lib/session";

// Tetapkan peran & outlet aktif lewat request terpisah (sesi dibaca ulang), lalu buka dashboard.
export async function GET(req: NextRequest) {
  const role = req.nextUrl.searchParams.get("role");
  const outletId = req.nextUrl.searchParams.get("outlet") || null;
  const s = await getSession();
  if (!s) return NextResponse.redirect(new URL("/login", req.url));
  const ok = s.assignments.some((a) => a.role === role && a.outletId === outletId);
  if (!ok) return NextResponse.redirect(new URL("/pilih-peran", req.url));
  await setActive({ role: role!, outletId });
  return NextResponse.redirect(new URL("/dashboard", req.url));
}
