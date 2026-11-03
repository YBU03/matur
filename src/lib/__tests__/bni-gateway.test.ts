import { beforeAll, describe, it, expect } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import {
  handleBni,
  issueToken,
  verifyToken,
  signature,
  validateNotice,
  type BniConfig,
  type BniStore,
  type Notice,
} from "../../../supabase/functions/_shared/bni-gateway";
let c: BniConfig;
const now = 1793664000;
const stamp = new Date(now * 1000).toISOString();
const p: Notice = {
  eventId: "event-1",
  outletCode: "KOMINOT",
  merchantId: "MID-test",
  referenceNo: "ref-1",
  amount: { value: "23000.00", currency: "IDR" },
  status: "PAID",
  paidAt: stamp,
  test: true,
};
beforeAll(() => {
  const k = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  c = {
    clientId: "test-bni",
    clientSecret: "test-only-secret-not-production",
    privateKey: k.privateKey,
    publicKey: k.publicKey,
    active: true,
  };
});
const basic = () => "Basic " + btoa(c.clientId + ":" + c.clientSecret);
function store(config: BniConfig | null = c) {
  const events = new Map<string, string>();
  const calls: { outlet: string; id: string }[] = [];
  const limits: string[] = [];
  const db: BniStore = {
    config: async () => config,
    limit: async (k) => {
      limits.push(k);
      return true;
    },
    receive: async (n, h) => {
      calls.push({ outlet: n.outletCode, id: n.eventId });
      if (events.has(n.eventId))
        return events.get(n.eventId) === h ? "duplicate" : "conflict";
      events.set(n.eventId, h);
      return "received";
    },
  };
  return { db, calls, limits };
}
async function callback(
  n: unknown,
  token: string,
  headers: Record<string, string> = {},
  raw?: string,
) {
  const body = raw ?? JSON.stringify(n);
  return new Request("https://www.matoer.id/api/integrasi/bni/callback", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer " + token,
      "x-matoer-timestamp": stamp,
      "x-matoer-signature": await signature(c.clientSecret, stamp, body),
      ...headers,
    },
    body,
  });
}
describe("Get Token Matoer", () => {
  it("client sah menerima RS256 token 300 detik dengan scope callback", async () => {
    const { db } = store();
    const r = await handleBni(
      new Request("https://www.matoer.id/get-token", {
        method: "POST",
        headers: { authorization: basic(), "content-type": "application/json" },
        body: JSON.stringify({ grant_type: "client_credentials" }),
      }),
      db,
      now,
    );
    const j = await r.json();
    expect(r.status).toBe(200);
    expect(j.expires_in).toBe(300);
    expect(await verifyToken(j.access_token, c, now)).toBe(true);
    expect(await verifyToken(j.access_token, c, now + 300)).toBe(false);
    expect(r.headers.get("cache-control")).toBe("no-store");
  });
  it("kredensial salah tidak memperoleh token dan tidak menghabiskan kuota client sah", async () => {
    const s = store();
    const r = await handleBni(
      new Request("https://x/get-token", {
        method: "POST",
        headers: {
          authorization: "Basic " + btoa("test-bni:wrong"),
          "content-type": "application/json",
        },
        body: '{"grant_type":"client_credentials"}',
      }),
      s.db,
      now,
    );
    expect(r.status).toBe(401);
    expect(s.limits).toEqual(["invalid-client"]);
    expect(s.calls).toEqual([]);
  });
  it("integrasi nonaktif tidak menerbitkan token", async () => {
    const r = await handleBni(
      new Request("https://x/get-token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
      store({ ...c, active: false }).db,
      now,
    );
    expect(r.status).toBe(503);
  });
  it("method, content type dan ukuran dibatasi", async () => {
    const db = store().db;
    expect(
      (await handleBni(new Request("https://x/get-token"), db, now)).status,
    ).toBe(405);
    expect(
      (
        await handleBni(
          new Request("https://x/get-token", { method: "POST", body: "{}" }),
          db,
          now,
        )
      ).status,
    ).toBe(415);
    expect(
      (
        await handleBni(
          new Request("https://x/get-token", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: "x".repeat(2049),
          }),
          db,
          now,
        )
      ).status,
    ).toBe(413);
  });
});
describe("callback Matoer", () => {
  it("menerima dua outlet, duplikat idempoten dan konflik ditolak", async () => {
    const s = store(),
      t = await issueToken(c, now);
    const a = await handleBni(await callback(p, t), s.db, now);
    expect(a.status).toBe(202);
    expect((await a.json()).processingStatus).toBe("RECEIVED_NOT_RECONCILED");
    expect((await handleBni(await callback(p, t), s.db, now)).status).toBe(200);
    expect(
      (
        await handleBni(
          await callback(
            { ...p, amount: { value: "24000.00", currency: "IDR" } },
            t,
          ),
          s.db,
          now,
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await handleBni(
          await callback({ ...p, eventId: "event-uhb", outletCode: "UHB" }, t),
          s.db,
          now,
        )
      ).status,
    ).toBe(202);
    expect(s.calls.at(-1)?.outlet).toBe("UHB");
  });
  it("token palsu atau expired tidak boleh menulis data", async () => {
    const s = store();
    expect(
      (await handleBni(await callback(p, "x.y.z"), s.db, now)).status,
    ).toBe(401);
    expect(
      (
        await handleBni(
          await callback(p, await issueToken(c, now - 301)),
          s.db,
          now,
        )
      ).status,
    ).toBe(401);
    expect(s.calls).toEqual([]);
  });
  it("tanda tangan, timestamp basi dan body yang diubah ditolak", async () => {
    const s = store(),
      t = await issueToken(c, now);
    const invalidHeaders: Record<string, string>[] = [
      { "x-matoer-signature": "0".repeat(64) },
      { "x-matoer-timestamp": "2020-01-01T00:00:00Z" },
    ];
    for (const h of invalidHeaders)
      expect((await handleBni(await callback(p, t, h), s.db, now)).status).toBe(
        401,
      );
    const raw = JSON.stringify(p);
    const req = await callback(
      p,
      t,
      {
        "x-matoer-signature": await signature(c.clientSecret, stamp, raw + " "),
      },
      raw,
    );
    expect((await handleBni(req, s.db, now)).status).toBe(401);
    expect(s.calls).toEqual([]);
  });
  it("outlet lain, nominal salah, currency lain dan status ambigu ditolak", async () => {
    const s = store(),
      t = await issueToken(c, now);
    for (const n of [
      { ...p, outletCode: "OUTLET-LAIN" },
      { ...p, amount: { value: "0.00", currency: "IDR" } },
      { ...p, amount: { value: "100.00", currency: "USD" } },
      { ...p, status: "SUCCESS" },
      { ...p, paidAt: undefined },
    ])
      expect((await handleBni(await callback(n, t), s.db, now)).status).toBe(
        422,
      );
    expect(s.calls).toEqual([]);
  });
  it("rate limit dan kegagalan penyimpanan tidak mengirim sukses palsu", async () => {
    const s = store(),
      t = await issueToken(c, now);
    s.db.limit = async () => false;
    expect((await handleBni(await callback(p, t), s.db, now)).status).toBe(429);
    s.db.limit = async () => true;
    s.db.receive = async () => {
      throw Error("private database message");
    };
    const r = await handleBni(await callback(p, t), s.db, now);
    expect(r.status).toBe(503);
    expect(await r.text()).not.toContain("private database");
  });
  it("data dinormalisasi agar urutan key tidak memengaruhi deduplikasi", () => {
    expect(validateNotice({ ...p, unexpected: "x" })).toBeNull();
    expect(validateNotice({ ...p, paidAt: "bukan-tanggal" })).toBeNull();
    expect(validateNotice(p)).toEqual(p);
  });
});
