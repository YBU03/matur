# Panel BNI Sandbox mengikuti collection RUMA

Tab BNI Sandbox di Pengaturan SNAP/ASPI sekarang menggunakan alur QRIS MPM pada SandboxAPIBNI.json yang diberikan BNI. Panel ASPI, penerima simulasi, gateway inbound, dan pengaturan QRIS statis/dinamis POS tidak diubah.

## Alur
- Token: POST https://sandbox.bni.co.id/snap/v1.0/access-token/b2b dengan JSON grantType=client_credentials, X-CLIENT-KEY, timestamp WIB dan signature RSA SHA256 atas clientId|timestamp.
- Generate QR: POST /snap-mpm/v1.0/qr/qr-mpm-generate. X-PARTNER-ID memakai API Key; signature HMAC SHA512 memakai Secret Key API atas POST:path:token:sha256(minified JSON):timestamp. Nominal, expiry 15 menit dan referensi unik disiapkan otomatis. Tanpa tip.
- Query: POST /snap-mpm/v1.0/qr/qr-mpm-query. Admin memilih hasil Generate QR berhasil dari riwayat server; referensi/merchant asli digunakan kembali dan perubahan konfigurasi mengharuskan QR baru. Respons query sukses tidak berarti pembayaran lunas.

Kredensial sandbox baru tersimpan di Vault. Client Secret disimpan sesuai paket kredensial tetapi tidak dipakai menggantikan API Secret dalam rumus signature layanan. Private key mengambil pasangan gateway asli yang sudah tersedia di Vault; tidak mengubah atau merotasi kunci gateway. Sertifikat yang ditampilkan memakai public key yang sama. API Key dimasking; secret/private key/token/signature tidak dikirim kembali ke browser atau dicatat ke riwayat.

Merchant ID, CHANNEL-ID dan Terminal ID dapat disimpan admin. Merchant/channel awal sengaja kosong: ID QRIS statis UHB belum dipastikan berlaku di sandbox dan CHANNEL-ID API dari contoh sebelumnya ditolak BNI. Tes token tetap tersedia tanpa merchant/channel; Generate QR baru bisa dimulai setelah keduanya diisi. Field secret kosong mempertahankan nilai lama, perubahan Client ID wajib kredensial lengkap.

Riwayat maksimum 200 hasil (50 terbaru ditampilkan), respons di-allowlist tanpa identitas nasabah. Pengujian gagal tetap mencatat kode HTTP/respons bank. Token tidak ditampilkan; unduh JSON hasil aman tersedia. Setiap tes menggunakan token BNI baru di server. Bila hasil jaringan tidak pasti, periksa riwayat sebelum mencoba Generate QR lagi.

Transaction Notification belum diaktifkan pada alur collection baru: folder QRIS MPM yang diberikan tidak mencakup request ini. Simulator lama/inbox header-only tidak dipakai sebagai bukti verifikasi pembayaran bank, tidak ada auto-lunas POS. Kontrak notifikasi harus dikonfirmasi BNI dahulu.

## Akses dan penyimpanan
Owner/Admin Pusat/Finance aktif sesuai guard panel yang sudah ada. Edge wajib memvalidasi JWT melalui Auth dan izin admin melalui RPC sebelum menjalankan aksi baru. RPC bni_snap_service hanya service_role; tabel privat RLS deny dan tidak diberi akses authenticated/anon. Tidak menerima host tujuan dari browser; hanya sandbox.bni.co.id dan tiga endpoint tetap, redirect ditolak. Request dibatasi guard/rate limit existing; respons bank dibatasi 32 KB; riwayat tidak berisi header autentikasi atau raw respons.

Migrasi 20261112043734_bni_snap_collection_panel sudah diterapkan. Kredensial aktual di-seed terpisah dari file migrasi/repository; tidak disalin ke Git. Hanya konfigurasi dan riwayat sandbox baru yang ditulis.

## Validasi
477 tes/81 berkas lolos, termasuk RSA dibandingkan verifier independen, HMAC dibandingkan Node crypto, grantType JSON, API Secret bukan Client Secret, error CHANNEL-ID, penolakan konfigurasi/nominal tidak lengkap, query terikat generation/version, respons terlalu besar dan penyamaran. PGlite memeriksa isolasi role, Vault/blank-preserve, pergantian Client ID dan retensi log.

Browser lokal dengan mock backend: status kredensial, tes token, guard merchant/channel, perubahan belum disimpan, simpan, respons 400 asli bentuknya, pilih QR/query, riwayat setelah reload, dan tanpa overflow pada 1440/390. Semua fixture dan bypass middleware dihapus sebelum build.

Mesin token baru diuji ke sandbox BNI dan mendapat HTTP 200 / 2007300 Successful / Bearer 900 detik; respons aman disimpan di riwayat. Edge produksi menolak admin tanpa JWT dengan 401. Advisor keamanan tidak menambah temuan dibanding baseline. Pengujian browser memakai data mock, bukan klaim Generate QR/Query BNI telah berhasil. Hasil bank sebenarnya untuk Generate QR sebelumnya masih 4004702 CHANNEL-ID. Data merchant/channel Ruma tetap menunggu konfirmasi BNI.

TypeScript, ESLint tanpa error, dan production build lolos.
