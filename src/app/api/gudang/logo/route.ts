import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (s?.status !== "aktif")
    return new Response("Unauthorized", { status: 401 });
  const db = await supabaseServer();
  const path = req.nextUrl.searchParams.get("path") ?? "";
  if (!/^logo\/[0-9a-f-]{36}\.(png|jpg)$/.test(path))
    return new Response("Logo tidak ditemukan.", { status: 404 });
  const { data, error: e } = await db.storage
    .from("dokumen-gudang")
    .download(path);
  if (e || !data)
    return new Response("Logo belum dapat dimuat.", { status: 404 });
  return new Response(data, {
    headers: {
      "Content-Type": path.endsWith(".jpg") ? "image/jpeg" : "image/png",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
