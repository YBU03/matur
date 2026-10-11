import { NextResponse, type NextRequest } from "next/server";
import { getSession, setActive } from "@/lib/session";

// Masuk otomatis bila portal hanya punya satu peran/outlet untuk pengguna ini.
export async function GET(req: NextRequest) {
  const role = req.nextUrl.searchParams.get("role");
  const outletId = req.nextUrl.searchParams.get("outlet") || null;
  const s = await getSession();
  if (!s) return NextResponse.redirect(new URL("/login", req.url));
  const ok = s.assignments.some((a) => a.role === role && a.outletId === outletId);
  await setActive(ok ? { role: role!, outletId } : null);
  return NextResponse.redirect(new URL(ok ? "/dashboard" : "/pilih-peran", req.url));
}
