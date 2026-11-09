# Pengujian SNAP / ASPI di Matoer — 9 November 2026

## Akses dan batas fitur

Menu `/pengaturan/snap-sandbox` tersedia untuk Owner, Admin Pusat dan Finance aktif. Owner/Admin Pusat juga mendapat tautan dari QRIS Outlet. Pilihan QRIS statis/dinamis dan gateway BNI lama tidak diubah.

Empat tab: Konfigurasi, 10 Pengujian, Client Simulator dan Riwayat. Data pengujian berada di schema privat `snap_sandbox_internal` dan bucket privat `snap-sandbox-bukti`, tidak menulis transaksi/pembayaran/stok/akuntansi/outlet asli maupun Demo. Ini persiapan pengujian; tidak menyatakan tes ASPI sudah lulus atau integrasi BNI produksi siap.

## Cara pakai

1. Dari Request Aplikasi Pengujian ASPI aktif, salin Client ID, Client Secret, Private Key/referensi ASPI dan Public Key/referensi ASPI ke tab Konfigurasi. Nilai contoh dokumentasi, localhost dan timestamp tahun 2020 tidak dipakai. Tidak ada kredensial asli yang diambil otomatis dari screenshot. Secret/private reference disimpan terenkripsi melalui Vault; setelah disimpan form rahasia dikosongkan dan tidak dikirim balik ke browser. Isian kosong saat edit berarti nilai lama dipertahankan. Mengganti Client ID memerlukan secret/private reference baru.
2. Lakukan Signature Access Token dan Token B2B pada portal Keamanan ASPI. Private Key pendek dari ASPI adalah referensi utilitas ASPI, bukan RSA PEM yang bisa langsung ditandatangani secara lokal. Signature Service membutuhkan token B2B ASPI, endpoint dan JSON body yang sama persis; portal ASPI tetap menjadi acuan. Bantuan Signature Service di Matoer menghitung HMAC SHA512 dan menyediakan format hex (contoh ASPI yang diberikan) atau base64 sesuai skenario.
3. Generate QR dan Query Payment Normal/Abnormal tetap dilakukan pada Aplikasi Pengujian MPM ASPI memakai data sandbox yang diwajibkan ASPI. Tautan portal tersedia. Tidak mengirim ke bank dari contoh merchant/terminal palsu. B2B2C tidak dihitung sebagai B2B Abnormal.
4. Untuk Payment Notification, aktifkan penerima sandbox Matoer. Pada Client Simulator pilih Normal atau Abnormal, isi nominal uji positif, klik Siapkan. Sistem mendaftarkan referensi MATOER-UJI yang terpisah, membuat token penerima Matoer melalui validator B2B, lalu menyediakan URI, header dan body untuk disalin ke Client Simulator ASPI. Normal memakai signature valid; Abnormal sengaja memakai signature salah dan mengharapkan 4015200. Gunakan isian dalam lima menit, jangan mengubah timestamp/body tanpa membuat signature baru. Token berumur 900 detik; batas timestamp notifikasi lima menit.
5. Pada tab 10 Pengujian, pilih salah satu dari sepuluh skenario, catat respons/status peninjauan, catatan dan bukti PNG/JPG/PDF maksimal 5 MB. Tutup rahasia di gambar/PDF sebelum mengunggah. Hanya field respons yang diizinkan disimpan; token, signature, identitas nasabah dan secret dihapus dari respons catatan. Nilai rahasia dan JWT juga ditutup dari catatan/teks respons. Status Sesuai adalah peninjauan admin, bukan pengesahan otomatis ASPI. Bukti asli dan hasil resmi tetap disimpan/diunduh di portal ASPI. Rekap admin dapat diunduh sebagai JSON; bukti privat dibuka dengan signed URL 60 detik.
6. Riwayat memisahkan hasil ASPI yang dicatat admin dari inbox notifikasi uji yang benar-benar diterima Matoer. Tidak ada status hasil otomatis palsu dari contoh respons.

## Penerima sandbox Matoer

Endpoint baru, bukan pengganti gateway BNI:
- `POST https://www.matoer.id/api/integrasi/snap-sandbox/v1.0/access-token/b2b`
- `POST https://www.matoer.id/api/integrasi/snap-sandbox/v1.0/qr/qr-mpm-notify`
- `GET https://www.matoer.id/api/integrasi/snap-sandbox/public-key`

Penerima menggunakan pasangan RSA 2048 uji Matoer yang dibuat saat konfigurasi awal dan disimpan di Vault. Kunci ini berbeda dari referensi ASPI dan kunci BNI produksi. Signature Access Token: RSA SHA256 atas clientId|timestamp, base64 (hex ekuivalen juga diterima untuk kompatibilitas uji). Signature notifikasi: HMAC SHA512 atas POST:path:token:sha256(minified JSON):timestamp. Path harus URI relatif endpoint publik di atas, bukan path Edge internal. Base64 atau hex ekuivalen didukung. Token HS256 penerima terikat client/audience/expiry dan ditandatangani rahasia acak server. Format token internal adalah detail OAuth server; tidak mengganti standar RSA untuk autentikasi request token.

Token/notifikasi memeriksa konfigurasi aktif, signature, timestamp, partner ID, external ID, channel ID, referensi uji terdaftar dan nominal. Body dibatasi 16 KB. Permintaan dibatasi 120 per menit per endpoint/akun admin. Notifikasi identik idempoten, event sama dengan payload berbeda ditolak, status sukses tidak diturunkan. Payload mentah/PII tidak disimpan: hanya ref/external ID/hash/status/nominal/waktu. Tidak ada pemicu lunas POS, SFX pembayaran nyata, stok atau buku besar.

Edge Function `matoer-snap-sandbox` memvalidasi autentikasi sendiri: publik hanya token/notifikasi yang berautentikasi protokol SNAP; rute admin wajib JWT Supabase valid serta otorisasi database pengguna aktif dengan role yang diizinkan. `verify_jwt=false` di gateway platform diperlukan untuk pengirim simulator eksternal, bukan akses admin terbuka. Next public proxy hanya meneruskan tiga path di atas dan header yang diizinkan; tidak menerima path admin atau host tujuan dari pengguna. Service-role key hanya berada di lingkungan Edge.

RPC publik invoker memanggil fungsi schema privat dengan guard eksplisit. Pengguna tidak memperoleh hak tabel; RLS dengan deny policy menjadi lapis tambahan. Fungsi service hanya dapat dieksekusi service_role. Simpan konfigurasi/toggle tercatat di log aktivitas tanpa nilai rahasia. Konfigurasi awal kosong dan penerima nonaktif; tidak menanam kredensial contoh.

## Validasi

Unit protokol menguji RSA/token/expiry/signature HMAC base64 dan hex, penggantian body/path, partner salah, header hilang, format/ukuran/method/content type, nonaktif/limit, konflik/duplikat, kebocoran respons dan penyamaran rahasia. PGlite menguji Vault melalui stub test, guard role, hak schema/tabel/fungsi, bukti privat, sanitasi di database, aturan perubahan konfigurasi, pencocokan referensi/nominal dan idempotensi. Stub Vault hanya untuk test lokal; produksi memakai Vault terenkripsi yang sudah tersedia.

Tes UI memakai komponen asli dengan backend lokal yang dimock, bukan kredensial/sertifikasi ASPI: sepuluh kartu, input/eye/clear secret, switch, isian simulator normal/abnormal, riwayat, unduh rekap dan batas nonaktif; tanpa overflow pada 1440/390/320 px. Fixture dan bypass middleware QA dibuang sebelum build.

Database produksi diverifikasi read-only sebagai authenticated owner melalui transaksi ROLLBACK: konfigurasi kosong/nonaktif dan status tanpa secret. Edge produksi versi 2 mengembalikan 5037300 untuk sandbox nonaktif dan 401 untuk admin tanpa JWT/JWT tidak sah. Security advisor tidak memiliki temuan baru dari baseline. Tidak menjalankan pengujian ASPI resmi atau transaksi pembayaran asli.

Referensi: https://apidevportal.aspi-indonesia.or.id/api-services/keamanan dan https://apidevportal.aspi-indonesia.or.id/api-services/transfer-kredit/mpm ; standar formula symmetric SNAP https://docs.espay.id/api-mandatory/snap/signature-symmetric/ . Kontrak provider BNI produksi tetap perlu disesuaikan dengan spesifikasi resmi BNI.

Validasi akhir: seluruh 448 tes pada 74 file lulus; setelah penguatan redaksi akhir, 13 tes protokol/SQL lulus kembali. TypeScript, ESLint, build produksi dan pemuatan dua compiled server-action entry pengaturan berhasil.

## CORS Client Simulator ASPI (9 November 2026 malam)

Client Simulator ASPI mengirim dari browser penguji, sehingga sebelumnya terblokir CORS. Proxy `src/app/api/integrasi/snap-sandbox/[...path]/route.ts` kini menjawab preflight `OPTIONS` (204) dan menambahkan header CORS **hanya** untuk origin `https://apidevportal.aspi-indonesia.or.id` (dengan/tanpa port 44310), helper `src/lib/snap-cors.ts`. Origin lain: preflight 403, tanpa header CORS. Autentikasi SNAP (token, signature, timestamp) tidak berubah; gateway BNI produksi tidak disentuh.
