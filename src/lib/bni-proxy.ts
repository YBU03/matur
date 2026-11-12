import "server-only";
import { readLimited } from "../../supabase/functions/_shared/bni-gateway";
export async function proxyBni(req: Request, path: "get-token" | "callback") {
  let raw: string;
  try {
    raw = await readLimited(req, path === "get-token" ? 2048 : 16384);
  } catch {
    return Response.json(
      { error: "invalid_or_oversized_body" },
      { status: 413, headers: { "Cache-Control": "no-store" } },
    );
  }
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base)
    return Response.json({ error: "integration_unavailable" }, { status: 503 });
  const headers = new Headers({
    "Content-Type": req.headers.get("content-type") ?? "",
  });
  for (const h of [
    "authorization",
    "x-client-key",
    "x-partner-id",
    "x-timestamp",
    "x-signature",
    "x-external-id",
    "channel-id",
    "x-matoer-timestamp",
    "x-matoer-signature",
  ]) {
    const v = req.headers.get(h);
    if (v) headers.set(h, v);
  }
  try {
    const r = await fetch(base + "/functions/v1/matoer-bni/" + path, {
      method: "POST",
      headers,
      body: raw,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(20000),
    });
    return new Response(await r.text(), {
      status: r.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        ...(r.status === 429 ? { "Retry-After": "60" } : {}),
      },
    });
  } catch {
    return Response.json(
      { error: "temporarily_unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
