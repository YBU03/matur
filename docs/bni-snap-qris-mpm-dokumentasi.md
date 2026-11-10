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

## 4. QRIS MPM — Query Payment
- `POST /snap-mpm/v1.0/qr/qr-mpm-query`, JSON, OAuth 2.0 client credential. Host/port "To be confirm".
- Header: `Content-Type` (application/json), `Authorization: Bearer <access_token>`, `X-SIGNATURE` (**"Symmetric Signature with Get Token"** = SNAP simetris HMAC-SHA512 memakai access token), `X-TIMESTAMP` (`yyyy-MM-ddTHH:mm:ssTZD`), `Origin` (opsional), `X-PARTNER-ID` (ID unik partner), `X-EXTERNAL-ID` (string angka, unik per hari), `CHANNEL-ID` (channel id PJP).
- Contoh body:
```json
{"additionalInfo":{"billNumber":"C09B880339"},"merchantId":"618299946","originalExternalId":"","originalPartnerReferenceNo":"202603261024","originalReferenceNo":"","serviceCode":"47"}
```
- Wajib: serviceCode (2, "47"), originalPartnerReferenceNo (64), merchantId (64), additionalInfo.billNumber. Opsional: originalReferenceNo (64), originalExternalId (32).
- Respons & response code: belum ada contoh.
- Catatan: `billNumber` kemungkinan berasal dari respons Generate QR / notifikasi (perlu konfirmasi).

## 5. QRIS MPM — Transaction Notification (BNI → merchant)
- Di sandbox ada **simulator**: `POST /simulator/callback/mpm/notif` dengan header **`X-CALLBACK-TARGET`** (URL webhook merchant tujuan), `X-TIMESTAMP`, `X-SIGNATURE`, `X-EXTERNAL-ID`, `CHANNEL-ID`, `X-PARTNER-ID`, `Content-Type`, `Authorization: Bearer`.
- URL webhook merchant berformat `{merchant webhook base url}/{version}/qr/qr-mpm-notify` → Matoer: `https://www.matoer.id/api/integrasi/pembayaran/v1.0/qr/qr-mpm-notify` (sudah didaftarkan di formulir BNI; endpoint belum aktif).
- Body utama: `originalReferenceNo` (wajib), `originalPartnerReferenceNo`, `latestTransactionStatus` (contoh "0"), `transactionStatusDesc` ("Transaksi Sukses"), `amount.value/currency`, `qrContent`; `additionalInfo`: billNumber, approvalCode, paidTime, nmid, merchantId, terminalId, rrn, stan, issuer/acquirer, amountMdr, feeAmount, **customerName & customerPan (data pribadi — jangan disimpan utuh)**.
- Contoh body ada di dokumentasi portal (merchant contoh "Duitkucom", nominal "0").
- Respons yang harus dikirim Matoer & kode respons: belum dijelaskan (standar SNAP: 2005200).

## Menunggu
Konfirmasi rumus signature (Generate/Query: simetris dengan token; notifikasi: belum jelas), contoh respons & response code, nilai CHANNEL-ID & X-PARTNER-ID, host/port final.

## 6. Uji dari Matoer (10 November 2026)
- Tab **BNI Sandbox** di `/pengaturan/snap-sandbox` (muncul setelah OAuth Client Secret tersimpan): tombol **1. Tes Generate QR** (gambar QR dari `qrContent`), **2. Tes Query Payment** (memakai partnerReferenceNo/billNumber hasil Generate), **3. Tes Notifikasi** (simulator BNI `/simulator/callback/mpm/notif`).
- Dikirim dari Edge Function `matoer-snap-sandbox` (v5) ke `sandbox.bni.co.id`: token OAuth langsung dari `/api/oauth/token`, X-SIGNATURE simetris HMAC-SHA512 (Client Secret) `POST:path:token:lowerhex(sha256(body)):timestamp`. Token & signature dimasking di tampilan.
- Nominal, merchantId (618299946), terminalId (301928301), CHANNEL-ID (95221) dan X-PARTNER-ID (default Kunci API) bisa diubah di layar bila BNI menolak.
- Penerima notifikasi uji: `https://www.matoer.id/api/integrasi/snap-sandbox/bni/v1.0/qr/qr-mpm-notify` (dipakai sebagai `X-CALLBACK-TARGET`). Disimpan ke `snap_sandbox_internal.bni_notif` (maks 200 baris, tanpa nama/PAN pelanggan), membalas `2005200`. **Tidak** menandai transaksi POS lunas.
