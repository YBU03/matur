import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (s?.status !== "aktif")
    return new Response("Unauthorized", { status: 401 });
  const db = await supabaseServer();
  const { data: g, error } = await db
    .from("pengaturan_dokumen_gudang")
    .select("logo_path")
    .eq("id", true)
    .single();
  if (
    error ||
    !g?.logo_path ||
    g.logo_path !== req.nextUrl.searchParams.get("path")
  )
    return new Response("Logo berubah. Muat ulang halaman.", { status: 404 });
  const { data, error: e } = await db.storage
    .from("dokumen-gudang")
    .download(g.logo_path);
  if (e || !data)
    return new Response("Logo belum dapat dimuat.", { status: 404 });
  return new Response(data, {
    headers: {
      "Content-Type": g.logo_path.endsWith(".jpg") ? "image/jpeg" : "image/png",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
