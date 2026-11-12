# BNI inbound notification sandbox

Get Token and callback retain the existing addresses:
- POST https://www.matoer.id/api/integrasi/bni/get-token
- POST https://www.matoer.id/api/integrasi/bni/callback

Requests with X-CLIENT-KEY or X-PARTNER-ID use the new inbound handler. Legacy Basic Auth / X-Matoer-Signature remains isolated and unchanged. No weakening to an unsigned Get Token or automatic acceptance of any sender key.

## Get Token

Content-Type application/json; X-CLIENT-KEY, X-TIMESTAMP, X-SIGNATURE.
Body: `{"grantType":"client_credentials"}`.
X-SIGNATURE = Base64 RSA-SHA256 signature of `clientId|X-TIMESTAMP`, verified against the registered **BNI sender public key** (SPKI PEM, RSA >=2048). This key must come from BNI, not from the Matoer outbound keypair or a collection sample. Maximum clock difference 300 seconds.

Response: HTTP200, responseCode2007300, accessToken, tokenTypeBearer, expiresIn300. JWT issued by Matoer, scoped to inbound notification. Client identity is distinct from outbound sandbox credentials.

## Callback

Content-Type application/json; Authorization Bearer token; X-TIMESTAMP; X-SIGNATURE; X-PARTNER-ID; X-EXTERNAL-ID (1-36 alphanumeric/underscore/hyphen); CHANNEL-ID.
Signing string:
`POST:/api/integrasi/bni/callback:accessToken:lowercaseHexSHA256(minifiedJSONBody):X-TIMESTAMP`
X-SIGNATURE = Base64 HMAC-SHA512(API Secret, signing string).

Body requires originalReferenceNo, originalPartnerReferenceNo, latestTransactionStatus and amount.value (positive two-decimal IDR). Supports success00 and failed06 plus other recognized statuses. Signature is checked before any storage; minification is JSON.parse followed by JSON.stringify without changing key order.

A valid notification is stored in private bni_internal.snap_inbox (environment sandbox, RECEIVED_NOT_RECONCILED), HTTP200 / 2005200. No POS, settlement, stock or accounting mutations. Same client/external ID and normalized body is idempotent; changed body under the same external ID returns409. Do not interpret receipt as payment reconciliation.

## Registration status and remaining dependency

Actual BNI client and API Secret are prepared privately in Vault. **BNI client stays inactive until BNI public key and inbound contract are confirmed.** Never replace the missing BNI public key with a generated Matoer key. Internal self-test uses a separate test identity and separate RSA signer; disable that test identity after live checks. Passing self-tests does not establish bank-to-Matoer interoperability.

RPCs are service_role-only with explicit role checks, fixed search_path, RLS and revoked anon/authenticated access. A pre-auth fixed rate bucket avoids attacker-supplied IDs growing the rate table. Atomic inbox inserts handle duplicates/conflicts. Existing gateway keypair is reused solely to issue/verify Matoer tokens; not rotated.

No secrets in repository, logs, or public document. Only the final private handover PDF may contain the dedicated API Secret, after real BNI registration and tests. Do not release the old draft as a ready-to-test credential document.

## Verification

Unit/security tests cover signature verification, token expiration, tampered payloads, identity isolation, required headers, amount format, duplicate/conflict handling and storage failures. PGlite checks service-only RPC permissions, fail-closed activation and inbox idempotency. Live self-test evidence is stored outside the repo, with access tokens removed.

## Aktivasi sandbox (12 Nov 2026, malam)
- Public key BNI sandbox (dari portal BNI Direct API: Aplikasi & Kredensial → Kredensial; sama dengan yang dicatat 10 Nov di `docs/snap-aspi-sandbox-2026-11-09.md`) dipasang pada client BNI asli di `bni_internal.snap_client`, lalu `active=true`. Client selftest tetap nonaktif.
- Kunci BNI tersebut **RSA 2047 bit**. Pemeriksaan `modulusLength<2048` akan menolak semua Get Token BNI, jadi batas diturunkan ke 2047 (kunci lemah seperti 1024 tetap ditolak; ada tes). Edge `matoer-bni` v4.
- Untuk BNI: Endpoint Get Token = `https://www.matoer.id/api/integrasi/bni/get-token`, Callback = `https://www.matoer.id/api/integrasi/bni/callback`, X-CLIENT-KEY = X-PARTNER-ID = client_id (bukan rahasia). API Secret hanya diserahkan privat oleh pemilik.
- Belum ada uji langsung dari BNI. Sandbox Claude tidak bisa memanggil matoer.id dan tidak punya private key BNI.
