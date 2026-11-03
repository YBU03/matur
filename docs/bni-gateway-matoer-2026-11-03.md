# Gateway BNI pada Matoer — kontrak Matoer v1

Layanan milik Matoer untuk pengajuan integrasi Kominot dan UHB. Ini bukan pernyataan bahwa BNI sudah menerima kontrak ini, bukan sertifikasi SNAP, dan bukan integrasi pembuatan QR/konfirmasi lunas BNI yang sudah selesai. Tim BNI harus menerima format pertukaran ini atau mengonfirmasi perubahan yang diperlukan.

## Alamat

- Get Token: `POST https://www.matoer.id/api/integrasi/bni/get-token`
- Callback: `POST https://www.matoer.id/api/integrasi/bni/callback`
- Public key: `GET https://www.matoer.id/api/integrasi/bni/public-key` (RSA 2048 SPKI PEM; kunci yang sudah dibuat sebelumnya, tidak dirotasi).
- Outlet code `KOMINOT` → Ruma Kopi Kominot; `UHB` → Ruma Kopi UHB. Outlet lain ditolak.

Spesifikasi mesin: `https://www.matoer.id/integrasi/bni/openapi.json`.

## Get Token

`Content-Type: application/json`. `Authorization: Basic base64(client_id:client_secret)`. Body `{"grant_type":"client_credentials"}`. Kredensial khusus BNI dibagikan terpisah secara privat, tidak ada di repository. Satu kredensial mencakup kedua outlet yang terdaftar.

Respons sukses 200: `{"access_token":"<JWT RS256>","token_type":"Bearer","expires_in":300,"scope":"qris:notify"}`. JWT dapat diverifikasi memakai public key Matoer; issuer `https://www.matoer.id`, audience `bni-qris-callback`. Jangan meminta token baru untuk setiap transaksi bila token sebelumnya masih valid. Respons tidak boleh di-cache publik.

## Callback

Header wajib:

```
Content-Type: application/json
Authorization: Bearer <access_token>
X-Matoer-Timestamp: <ISO8601 dengan timezone, selisih maksimum 300 detik>
X-Matoer-Signature: <hex lowercase HMAC-SHA256(client_secret, timestamp + "." + raw_body)>
```

Contoh struktur payload (bukan transaksi asli):

```json
{"eventId":"event-unik-bni","outletCode":"KOMINOT","merchantId":"<identitas resmi BNI>","referenceNo":"<referensi pembayaran>","amount":{"value":"23000.00","currency":"IDR"},"status":"PAID","paidAt":"2026-11-03T14:00:00+07:00"}
```

`eventId` dan `referenceNo` wajib unik sesuai sumber (maksimum 120 karakter); status `PAID`, `PENDING`, `FAILED`, `EXPIRED`; `paidAt` wajib untuk PAID. Nominal harus string desimal positif dua angka desimal, IDR. `test:true` hanya untuk uji; tidak ikut buku besar. Payload dengan field/format lain ditolak agar tidak salah menafsirkan pesan bank. Jangan mengirim data kartu, PIN, atau informasi pribadi yang tidak diperlukan.

Respons 202 untuk notifikasi baru, 200 untuk pengulangan identik, 409 bila event ID sama dengan isi berbeda. `processingStatus: RECEIVED_NOT_RECONCILED` berarti notifikasi diterima, **bukan** tanda bahwa transaksi POS sudah dicatat/lunas. Respons 400/413/415/422 menunjukkan format/ukuran salah; 401 autentikasi tidak sah; 429 batas laju (tunggu 60 detik); 503 kegagalan sementara dan perlu retry. Token maksimum 60 permintaan berhasil/menit/client; callback maksimum 600 permintaan terverifikasi/menit/client. Permintaan dengan kredensial salah memakai kuota terpisah dan tidak menghabiskan kuota client sah.

## Penyimpanan dan operasional

Next.js hanya meneruskan permintaan ke Edge Function `matoer-bni` dengan timeout dan batas ukuran. Edge menjalankan autentikasi sendiri (`verify_jwt=false` hanya untuk gateway platform, bukan berarti callback tanpa autentikasi). Data gateway berada di schema privat `bni_internal`, RLS aktif dan tanpa hak tabel anon/pengguna aplikasi. Tiga RPC hanya dapat dieksekusi service_role; setiap fungsi juga memeriksa role server. Private key serta client secret disimpan terenkripsi pada Supabase Vault. Tidak ada private key/token/client secret yang dicetak ke log atau dimasukkan ke Git.

Notifikasi hanya dicatat ke inbox privat dengan status `diterima_belum_direkonsiliasi`. Belum menulis transaksi, pembayaran, stok, pengeluaran, atau akuntansi. Tidak mengaktifkan QRIS dinamis pada pengaturan outlet. Koneksi keluar ke API generate QR BNI, pemetaan Merchant ID/Terminal ID, pencocokan reference/nominal dengan payment intent POS, status/reversal bank dan aktivasi suara otomatis perlu integrasi lanjutan sesuai kesepakatan BNI. Ini mencegah notifikasi yang belum dipetakan dianggap sebagai transaksi lunas.

Untuk menonaktifkan gateway: atur `bni_internal.konfigurasi.aktif=false` oleh operator database berwenang. Token yang masih berlaku ikut ditolak saat konfigurasi nonaktif. Penambahan outlet memerlukan pemetaan outlet dan perluasan allowlist kontrak; tidak otomatis mengizinkan seluruh outlet. Rotasi client secret/private key harus terkoordinasi dengan BNI.

## Pemeriksaan

Unit menguji token RS256/expiry, kredensial, method/tipe/ukuran body, HMAC/timestamp, outlet/nominal/status, idempotensi, konflik event ID dan kegagalan penyimpanan. Uji HTTP di server menggunakan event `MATOER-SELFTEST-*`, `test:true`, status PENDING, Rp1 untuk kedua outlet; hanya inbox privat yang menerima event tersebut.

Validasi 3 November 2026: 377 tes / 60 berkas lolos; TypeScript, ESLint tanpa error, dan build produksi berhasil. Edge versi 2 diuji langsung: Get Token 200, kedua outlet callback 202, duplikat 200, tanda tangan palsu 401. Advisor hanya mencatat RLS tanpa policy pada empat tabel privat: disengaja untuk menolak akses pengguna; RPC server-only telah diperiksa.
