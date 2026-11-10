import { readSnapBody } from "../../../../../../supabase/functions/_shared/snap-sandbox";
import { corsSnap, SNAP_TERUSKAN } from "@/lib/snap-cors";
export const dynamic = "force-dynamic";

const PATHS = ["/v1.0/access-token/b2b", "/v1.0/qr/qr-mpm-notify", "/public-key", "/bni/v1.0/qr/qr-mpm-notify"];
const TERUSKAN = SNAP_TERUSKAN;

const jalur = async (params: Promise<{ path: string[] }>) => "/" + (await params).path.join("/");

async function proxy(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const cors = corsSnap(req.headers.get("origin"));
  const path = await jalur(params);
  if (!PATHS.includes(path)) return Response.json({ error: "Not found" }, { status: 404, headers: cors });
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return Response.json({ error: "Sandbox unavailable" }, { status: 503, headers: cors });
  let raw: string | undefined;
  if (req.method === "POST")
    try {
      raw = await readSnapBody(req);
    } catch {
      return Response.json({ error: "Body invalid or too large" }, { status: 413, headers: cors });
    }
  const headers = new Headers();
  for (const k of TERUSKAN) {
    const v = req.headers.get(k);
    if (v) headers.set(k, v);
  }
  try {
    const r = await fetch(base + "/functions/v1/matoer-snap-sandbox" + path, { method: req.method, headers, body: raw, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20000) });
    return new Response(await r.text(), { status: r.status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...cors } });
  } catch {
    return Response.json({ error: "Sandbox temporarily unavailable" }, { status: 503, headers: { "Cache-Control": "no-store", ...cors } });
  }
}

// Preflight browser (Client Simulator ASPI): tidak meneruskan apa pun ke Edge.
async function preflight(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const cors = corsSnap(req.headers.get("origin"));
  if (!PATHS.includes(await jalur(params)) || !Object.keys(cors).length) return new Response(null, { status: 403 });
  return new Response(null, { status: 204, headers: cors });
}

export const GET = proxy;
export const POST = proxy;
export const OPTIONS = preflight;
