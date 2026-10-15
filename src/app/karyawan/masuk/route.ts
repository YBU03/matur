import { NextRequest, NextResponse } from "next/server";
import { getSession, setActive } from "@/lib/session";
import { POS_ROLES } from "@/lib/roles";
export async function GET(req: NextRequest) {
  const s = await getSession();
  const outlet = req.nextUrl.searchParams.get("outlet");
  const tugas = s?.assignments
    .filter((a) => POS_ROLES.includes(a.role) && a.outletId === outlet)
    .sort(
      (a, b) =>
        ["spv", "kasir", "barista"].indexOf(a.role) -
        ["spv", "kasir", "barista"].indexOf(b.role),
    )[0];
  if (!tugas) return NextResponse.redirect(new URL("/karyawan", req.url));
  await setActive(tugas);
  return NextResponse.redirect(new URL("/karyawan", req.url));
}
