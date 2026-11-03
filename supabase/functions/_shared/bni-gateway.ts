/** Kontrak gateway Matoer v1. Bukan klaim kompatibilitas/sertifikasi SNAP BNI. */
export type BniConfig = {
  clientId: string;
  clientSecret: string;
  privateKey: string;
  publicKey: string;
  active: boolean;
};
export type BniStore = {
  config: () => Promise<BniConfig | null>;
  limit: (key: string, n: number) => Promise<boolean>;
  receive: (
    payload: Notice,
    hash: string,
    clientId: string,
  ) => Promise<"received" | "duplicate" | "conflict">;
};
export type Notice = {
  eventId: string;
  outletCode: "KOMINOT" | "UHB";
  merchantId: string;
  referenceNo: string;
  amount: { value: string; currency: "IDR" };
  status: "PAID" | "PENDING" | "FAILED" | "EXPIRED";
  paidAt?: string;
  test?: boolean;
};
const enc = new TextEncoder();
const ISS = "https://www.matoer.id";
const AUD = "bni-qris-callback";
const b64 = (b: Uint8Array) =>
  btoa(String.fromCharCode(...b))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
const un64 = (s: string) =>
  Uint8Array.from(atob(s.replaceAll("-", "+").replaceAll("_", "/")), (c) =>
    c.charCodeAt(0),
  );
const pem = (s: string) =>
  Uint8Array.from(atob(s.replace(/-----[^-]+-----|\s/g, "")), (c) =>
    c.charCodeAt(0),
  );
const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
export async function digest(s: string) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s))),
    (x) => x.toString(16).padStart(2, "0"),
  ).join("");
}
async function eq(a: string, b: string) {
  const x = await digest(a),
    y = await digest(b);
  let n = 0;
  for (let i = 0; i < x.length; i++) n |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return n === 0;
}
export async function signature(
  secret: string,
  timestamp: string,
  body: string,
) {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return Array.from(
    new Uint8Array(
      await crypto.subtle.sign("HMAC", key, enc.encode(timestamp + "." + body)),
    ),
    (x) => x.toString(16).padStart(2, "0"),
  ).join("");
}
export async function issueToken(c: BniConfig, now: number) {
  const h = b64(enc.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const p = b64(
    enc.encode(
      JSON.stringify({
        iss: ISS,
        aud: AUD,
        sub: c.clientId,
        scope: "qris:notify",
        iat: now,
        exp: now + 300,
        jti: crypto.randomUUID(),
      }),
    ),
  );
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pem(c.privateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    enc.encode(h + "." + p),
  );
  return h + "." + p + "." + b64(new Uint8Array(sig));
}
export async function verifyToken(token: string, c: BniConfig, now: number) {
  try {
    const a = token.split(".");
    if (a.length !== 3 || token.length > 4096) return false;
    const h = JSON.parse(new TextDecoder().decode(un64(a[0])));
    if (h.alg !== "RS256" || h.typ !== "JWT") return false;
    const key = await crypto.subtle.importKey(
      "spki",
      pem(c.publicKey),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    if (
      !(await crypto.subtle.verify(
        "RSASSA-PKCS1-v1_5",
        key,
        un64(a[2]),
        enc.encode(a[0] + "." + a[1]),
      ))
    )
      return false;
    const p = JSON.parse(new TextDecoder().decode(un64(a[1])));
    return (
      p.iss === ISS &&
      p.aud === AUD &&
      p.sub === c.clientId &&
      p.scope === "qris:notify" &&
      Number.isInteger(p.iat) &&
      Number.isInteger(p.exp) &&
      p.iat <= now + 30 &&
      p.exp > now &&
      p.exp - p.iat === 300
    );
  } catch {
    return false;
  }
}
export async function readLimited(req: Request, max = 16384) {
  if (Number(req.headers.get("content-length") ?? 0) > max)
    throw new Error("too_large");
  const reader = req.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let len = 0;
  for (;;) {
    const r = await reader.read();
    if (r.done) break;
    len += r.value.length;
    if (len > max) {
      await reader.cancel();
      throw new Error("too_large");
    }
    chunks.push(r.value);
  }
  const out = new Uint8Array(len);
  let i = 0;
  for (const b of chunks) {
    out.set(b, i);
    i += b.length;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(out);
}
export function validateNotice(v: unknown): Notice | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const p = v as Record<string, unknown>;
  const str = (x: unknown, n: number) =>
    typeof x === "string" &&
    x.trim().length > 0 &&
    x.length <= n &&
    !/[\x00-\x1f]/.test(x);
  const a = p.amount as Record<string, unknown> | null;
  const statuses = ["PAID", "PENDING", "FAILED", "EXPIRED"];
  if (
    !str(p.eventId, 120) ||
    !str(p.referenceNo, 120) ||
    !str(p.merchantId, 100) ||
    !["KOMINOT", "UHB"].includes(String(p.outletCode)) ||
    !statuses.includes(String(p.status)) ||
    !a ||
    a.currency !== "IDR" ||
    typeof a.value !== "string" ||
    !/^\d{1,12}\.\d{2}$/.test(a.value) ||
    Number(a.value) <= 0
  )
    return null;
  if (p.test !== undefined && typeof p.test !== "boolean") return null;
  if (
    p.paidAt !== undefined &&
    (typeof p.paidAt !== "string" ||
      p.paidAt.length > 40 ||
      !/(Z|[+-]\d{2}:\d{2})$/.test(p.paidAt) ||
      !Number.isFinite(Date.parse(p.paidAt)))
  )
    return null;
  if (p.status === "PAID" && !p.paidAt) return null;
  const allowed = [
    "eventId",
    "outletCode",
    "merchantId",
    "referenceNo",
    "amount",
    "status",
    "paidAt",
    "test",
  ];
  if (
    Object.keys(p).some((k) => !allowed.includes(k)) ||
    Object.keys(a).some((k) => !["value", "currency"].includes(k))
  )
    return null;
  return {
    eventId: p.eventId as string,
    outletCode: p.outletCode as Notice["outletCode"],
    merchantId: p.merchantId as string,
    referenceNo: p.referenceNo as string,
    amount: { value: a.value, currency: "IDR" },
    status: p.status as Notice["status"],
    ...(p.paidAt ? { paidAt: p.paidAt as string } : {}),
    ...(p.test !== undefined ? { test: p.test as boolean } : {}),
  };
}
export async function handleBni(
  req: Request,
  store: BniStore,
  now = Math.floor(Date.now() / 1000),
): Promise<Response> {
  const path = new URL(req.url).pathname;
  const tokenPath = path.endsWith("/get-token"),
    callbackPath = path.endsWith("/callback");
  if (!tokenPath && !callbackPath) return json({ error: "not_found" }, 404);
  if (req.method !== "POST")
    return new Response(null, {
      status: 405,
      headers: { Allow: "POST", "Cache-Control": "no-store" },
    });
  if (
    !req.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  )
    return json({ error: "content_type_must_be_json" }, 415);
  try {
    const c = await store.config();
    if (!c?.active) return json({ error: "integration_unavailable" }, 503);
    let raw: string;
    try {
      raw = await readLimited(req, tokenPath ? 2048 : 16384);
    } catch {
      return json({ error: "invalid_or_oversized_body" }, 413);
    }
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return json({ error: "invalid_json" }, 400);
    }
    if (tokenPath) {
      let id = "",
        secret = "";
      try {
        const auth = req.headers.get("authorization") ?? "";
        if (!auth.startsWith("Basic "))
          return json({ error: "invalid_client" }, 401);
        const v = atob(auth.slice(6));
        const i = v.indexOf(":");
        if (i < 1) return json({ error: "invalid_client" }, 401);
        id = v.slice(0, i);
        secret = v.slice(i + 1);
      } catch {
        return json({ error: "invalid_client" }, 401);
      }
      const validId = await eq(id, c.clientId),
        validSecret = await eq(secret, c.clientSecret);
      if (!validId || !validSecret) {
        const ok = await store.limit("invalid-client", 60);
        return json(
          { error: ok ? "invalid_client" : "rate_limited" },
          ok ? 401 : 429,
        );
      }
      if (!(await store.limit("token:" + c.clientId, 60)))
        return json({ error: "rate_limited" }, 429);
      if (
        !body ||
        typeof body !== "object" ||
        (body as Record<string, unknown>).grant_type !== "client_credentials"
      )
        return json({ error: "unsupported_grant_type" }, 400);
      return json({
        access_token: await issueToken(c, now),
        token_type: "Bearer",
        expires_in: 300,
        scope: "qris:notify",
      });
    }
    const auth = req.headers.get("authorization") ?? "";
    if (
      !auth.startsWith("Bearer ") ||
      !(await verifyToken(auth.slice(7), c, now))
    )
      return json({ error: "invalid_token" }, 401);
    const stamp = req.headers.get("x-matoer-timestamp") ?? "";
    const sig = req.headers.get("x-matoer-signature") ?? "";
    if (
      !/^\d{4}-\d{2}-\d{2}T.+(Z|[+-]\d{2}:\d{2})$/.test(stamp) ||
      !Number.isFinite(Date.parse(stamp)) ||
      Math.abs(Date.parse(stamp) / 1000 - now) > 300 ||
      !/^[a-f0-9]{64}$/.test(sig) ||
      !(await eq(sig, await signature(c.clientSecret, stamp, raw)))
    )
      return json({ error: "invalid_signature" }, 401);
    if (!(await store.limit("callback:" + c.clientId, 600)))
      return json({ error: "rate_limited" }, 429);
    const p = validateNotice(body);
    if (!p) return json({ error: "invalid_notification" }, 422);
    const result = await store.receive(
      p,
      await digest(JSON.stringify(p)),
      c.clientId,
    );
    if (result === "conflict") return json({ error: "event_id_conflict" }, 409);
    return json(
      {
        status: result,
        eventId: p.eventId,
        processingStatus: "RECEIVED_NOT_RECONCILED",
      },
      result === "received" ? 202 : 200,
    );
  } catch {
    return json({ error: "temporarily_unavailable" }, 503);
  }
}
