# Catatan dokumentasi BNI Direct API — SNAP QRIS MPM (dari portal BNI, 10 Nov 2026)

Kumpulan potongan dokumentasi yang dikirim pemilik. Belum diimplementasikan kecuali disebut. Rahasia (secret/private key) tidak dicatat di sini.

## 1. OAuth token (✅ sudah diuji dari Matoer, 10 Nov 2026)
- Host: produksi `https://api.bni.co.id`, non-produksi `https://newapidev.bni.co.id` (port dev 8066, testing 8065), sandbox `https://sandbox.bni.co.id/` (443).
- `POST /api/oauth/token`, `Authorization: Basic base64(client_id:client_secret)` (Kredensial OAuth), `Content-Type: application/x-www-form-urlencoded`, body `grant_type=client_credentials`.
- Respons: `access_token`, `token_type: Bearer`, `expires_in` (sandbox 900 detik), `scope: resource.WRITE resource.READ`. Error: HTTP 401.
- Hasil uji tab BNI Sandbox Matoer: berhasil (token didapat, berlaku 900 detik).

## 2. Tanda tangan JWT (API BNI non-SNAP, mis. OGP H2H)
- Header `{"alg":"HS256","typ":"JWT"}`; payload = body request (tanpa field `signature`); HMAC-SHA256 dengan **API Secret Key (Kunci API)**; hasil `base64url(header).base64url(payload).base64url(sig)` dimasukkan ke field `signature` body.
- Sandbox punya utilitas `jwtCreator` (butuh centang "API utility" di aplikasi).
- Belum terlihat dipakai pada SNAP QRIS MPM (menunggu konfirmasi dokumentasi signature SNAP).

## 3. QRIS MPM — Generate QR Code
- Host/port: "To be confirm" (sandbox kemungkinan `sandbox.bni.co.id:443`).
- `POST /snap-mpm/v1.0/qr/qr-mpm-generate`, JSON, OAuth 2.0 client credential.
- Header wajib: `Content-Type`, `X-TIMESTAMP`, `X-SIGNATURE`, `X-PARTNER-ID`, `X-EXTERNAL-ID`, `CHANNEL-ID`, `Authorization: Bearer <token>`.
- Contoh body:
```json
{"additionalInfo":{"additionalData":"","tipIndicator":"03","tipValueFixed":"","tipValuePercentage":""},"amount":{"currency":"IDR","value":"20000.00"},"merchantId":"012000046","partnerReferenceNo":"401010104","terminalId":"213141251124","validityPeriod":"2024-11-29T18:20:44+07:00"}
```
- Wajib: validityPeriod, partnerReferenceNo, merchantId, amount.value, amount.currency. Opsional: terminalId, additionalInfo.tipValuePercentage/tipValueFixed/tipIndicator/additionalData.
- Respons & kode respons: belum ada contoh di dokumentasi.
- Belum dijelaskan: rumus X-SIGNATURE (dugaan SNAP: HMAC-SHA512 `POST:path:accessToken:lowerhex(SHA256(minified body)):timestamp` dengan Client Secret), nilai CHANNEL-ID, X-PARTNER-ID (dugaan: Kunci API / client id).

## Menunggu
Query Payment, Payment Notification, rumus signature SNAP, daftar response code.
