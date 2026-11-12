import { handleBni } from "../_shared/bni-gateway.ts";
import { handleInbound } from "../_shared/bni-inbound.ts";
const url = Deno.env.get("SUPABASE_URL");
const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
async function rpc(name, body = {}) {
  if (!url || !secret) throw new Error("unconfigured");
  const r = await fetch(url + "/rest/v1/rpc/" + name, {
    method: "POST",
    headers: {
      apikey: secret,
      Authorization: "Bearer " + secret,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error("storage_unavailable");
  return await r.json();
}
Deno.serve((req) =>
  (req.headers.has("x-client-key") || req.headers.has("x-partner-id")) ? handleInbound(req, {
    config: (p_id) => rpc("bni_inbound_config", {p_id}),
    limit: (p_kunci,p_limit) => rpc("bni_gateway_batas",{p_kunci,p_limit}),
    receive: (p_client,p_external,p_hash,p_payload) => rpc("bni_inbound_receive",{p_client,p_external,p_hash,p_payload}),
  }) : handleBni(req, {
    config: () => rpc("bni_gateway_konfigurasi"),
    limit: (p_kunci, p_limit) => rpc("bni_gateway_batas", { p_kunci, p_limit }),
    receive: (p, p_hash, p_client) =>
      rpc("bni_gateway_terima", {
        p_client,
        p_event: p.eventId,
        p_kode: p.outletCode,
        p_ref: p.referenceNo,
        p_hash,
        p_payload: p,
        p_test: p.test === true,
      }),
  }),
);
