# QR dinamis simulasi POS Outlet Demo — 9 November 2026

Fitur hanya untuk ID `dc2f5309-5f4a-4bed-9cb8-3f93c8e2d146`. Pengaturan QRIS Dinamis Demo dipakai untuk simulasi internal, bukan QRIS bank, sandbox Generate QR ASPI, atau transaksi BNI produksi. Kominot/UHB tetap statis dan guard pembayaran dinamis operasional pada `bayar()` tidak diubah.

## Cara mencoba

1. Pengaturan → QRIS Outlet → Outlet Demo → QRIS Dinamis → Simpan. Demo sudah diaktifkan saat penyiapan ini; gambar/kode statis lama tetap tersimpan.
2. Masuk akun POS Outlet Demo melalui `/pos`, buka ulang POS agar pengaturan terbaru dimuat.
3. Tambah produk, pilih QRIS, klik Bayar. Simulasi memakai pembayaran penuh, tanpa split/draft. Harga menu, additional, kanal, diskon dan total dihitung di database; nominal browser tidak dipercaya.
4. Pindai QR menggunakan kamera HP (bukan aplikasi bank/e-wallet), atau klik Buka simulasi di perangkat ini.
5. Tekan Simulasikan pembayaran berhasil. POS memeriksa status setiap 2,5 detik dan menampilkan struk TESTING. Tidak ada uang nyata.
6. Riwayat QR simulasi pada POS membuka `/kasir/qris-demo`; 50 percobaan terakhir, status serta struk salinan tersedia. Struk berlabel TESTING, termasuk PDF/cetak/WhatsApp yang menggunakan komponen struk yang sudah ada.

QR berlaku 10 menit. Batal mengunci order pending; QR kedaluwarsa/dibatalkan tidak dapat dibayar. Jika pembayaran mendahului pembatalan, status paid dipertahankan dan struk ditampilkan. Retry create dengan client_id sama dan keranjang sama mengembalikan order sama; keranjang berubah ditolak. Konfirmasi berulang tidak membuat order baru. Jika koneksi terputus, polling mencoba lagi dan tombol pembatalan tidak menutup sebelum hasil terkonfirmasi.

## Batas data dan akses

Tabel baru `qris_demo_internal.pesanan` menyimpan snapshot item/harga, status, waktu, pembuat, token acak dan nomor tersendiri. Tidak menulis `transaksi`, pembayaran operasional, item transaksi, stok, kas, draft, laporan atau akunting. Data simulasi sengaja ada di riwayat tersendiri, bukan daftar omzet/antrean operasional.

Tabel privat RLS deny/no grants langsung. RPC publik invoker menuju fungsi privat dengan guard pengguna aktif/peran/outlet. Client tidak dapat mengalihkan simulasi ke outlet lain. Halaman konfirmasi publik hanya melalui token acak 256 bit yang tidak dapat ditebak, menampilkan nomor/nominal/status/expiry tanpa PII/checkout. Halaman noindex dan referrer no-referrer. GET hanya baca; pembayaran membutuhkan aksi POST. Kredensial ASPI/BNI tidak dipakai/dibuka dalam alur ini.

Migrasi tidak mengganti fungsi transaksi operasional dan tidak mengubah baris outlet. Aktivasi Demo dilakukan terpisah lewat RPC pengaturan QRIS existing, pada ID Demo saja. Verifikasi setelah aktivasi: Demo dinamis, Kominot/UHB statis.

## Validasi

454 tes / 75 file lulus, termasuk 6 tes baru PGlite: server pricing, duplicate create/payment, perubahan keranjang, split/draft/varian/jumlah invalid, expiry/cancel/nonaktif, privilege dan penolakan non-Demo. Pengujian DB produksi menggunakan transaksi ROLLBACK membuktikan create/pay/retry Demo, penolakan Kominot, dan jumlah transaksi operasional tidak berubah. Advisor tidak menyebut schema/fungsi baru.

Uji browser memakai komponen POS dan halaman pembayaran asli dengan backend server-action mock, viewport 390 px: POS → QR → halaman pembayaran → konfirmasi → polling → struk testing; jalur QRIS statis tetap menampilkan konfirmasi kasir aktif. Fixture dan pengecualian middleware QA dibuang sebelum build. Ini bukan bukti kelulusan ASPI.

TypeScript/ESLint dan build produksi lulus. Fixture QA memakai pembungkus padding yang sama dengan layout POS asli; tidak ada overflow pada halaman pembayaran/struk viewport 390 px.
