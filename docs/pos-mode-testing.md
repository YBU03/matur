> Arsip: alur ini dinonaktifkan atas instruksi pemilik 26 Oktober 2026. Jalur aktif memakai [POS login langsung](pos-login-langsung.md). Jangan mengaktifkan kembali pengunci tanpa persetujuan baru.

# Mode Testing POS Outlet Demo

Login tetap menggunakan akun POS outlet. Ketika flag testing aktif, `/pos` mengarahkan tablet ke `/pos/testing` tanpa mensyaratkan jadwal, Clock In, PIC, modal, atau sesi kas. Halaman terminal tablet juga dialihkan. Katalog hanya diberikan kepada akun tablet yang memiliki token perangkat aktif dan kredensial outlet yang masih berlaku.

Kontrol aktif/nonaktif tersedia pada Pengaturan POS untuk Owner/Admin Pusat dan HRD. Kewenangan diperiksa kembali di database menggunakan pengguna aktif dan penugasan aktual, bukan user_metadata. Perubahan memiliki guard versi dan audit `atur_testing_pos`. Panel menampilkan seluruh outlet aktif sesuai kewenangan, termasuk outlet yang belum pernah testing (default nonaktif, versi null). HRD dibatasi penugasan outlet; penugasan HRD pusat mencakup seluruh outlet. Owner/Admin Pusat dapat mengatur semuanya. Pengaturan pertama diserialkan dengan kunci baris outlet; perubahan berikutnya memakai guard versi. RLS aktif tanpa policy dan tanpa grants langsung untuk anon/authenticated sengaja menutup tabel privat; RPC SECURITY DEFINER dengan search_path kosong dan pemeriksaan akses merupakan satu-satunya jalur aplikasi.

Keranjang memakai perhitungan simulasi lokal. Pembayaran latihan tidak memanggil endpoint transaksi, shift, persediaan, atau setoran dan tidak menyimpan antrean offline. Data latihan hilang ketika halaman dimuat ulang. Komponen struk dipakai bersama POS asli, dengan tanda `TESTING · BUKAN TRANSAKSI ASLI` pada tampilan, WhatsApp, dan ESC/POS. Cetak browser, Bluetooth, RawBT dan pilihan 58/80 mm tetap mengikuti dukungan perangkat/browser yang sama seperti POS biasa.

Database menolak checkout asli baru dari outlet yang sedang testing, termasuk tab lama. Antrean offline dari sebelum waktu aktivasi tetap melewati pemeriksaan izin/sesi lama agar riwayat tidak hilang. Menonaktifkan testing mengembalikan aturan normal; klien online memeriksa flag tiap 15 detik dan ketika tab dibuka kembali. Dalam keadaan offline halaman latihan yang sudah terbuka dapat tetap menghitung lokal, tetapi tidak menulis transaksi asli.

Migrasi awal mengaktifkan flag untuk Outlet Demo sesuai permintaan testing. Data absensi, transaksi, sesi kas, dan password yang sudah ada tidak diubah.

## Verifikasi

- Build produksi lulus; peringatan lint lama pada simulasi-view tetap ada.
- Tujuh tes perhitungan simulasi dan transport printer tiruan lulus.
- `supabase/tests/pos_testing.sql` lulus dengan fixture dalam transaksi ROLLBACK: pilihan semua outlet, kewenangan pusat/HRD sesuai outlet, token/akun perangkat, katalog tanpa shift, perubahan versi/audit, menonaktifkan mode, penolakan penjualan asli baru, jalur sinkronisasi historis, dan tidak adanya sesi/transaksi keuangan baru.
- Security advisors ditinjau. Advisory tabel privat tanpa policy dan RPC SECURITY DEFINER tersebut disengaja serta dibatasi grants dan pemeriksaan akses di dalam fungsi.
- Printer fisik dan sesi browser pengguna belum diuji; tes transport memakai printer tiruan.


## Perbaikan akses training HRD — 26 Oktober 2026

Menu **Akses Kasir POS per Outlet → Mode Testing POS** sekarang terlihat untuk HRD dan Admin Pusat/Owner, sekalipun outlet belum memiliki pengaturan testing. Konfirmasi menjelaskan bahwa semua perangkat outlet masuk testing, transaksi asli baru diblokir, dan kas tertutup tidak dibuka ulang. Setelah dinonaktifkan, muat ulang POS untuk kembali ke aturan normal. Pesan kas tanggal ini sudah ditutup mengarahkan pengguna ke pengaturan ini untuk keperluan latihan.

Migrasi `20261026033059_pos_testing_hrd_outlet.sql` menempatkan pemeriksaan akses di fungsi dalam schema privat khusus `pos_training_internal` (migrasi lanjutan `20261026033444_pos_testing_private_rpc_schema.sql`) dengan wrapper publik SECURITY INVOKER, tanpa grant tabel langsung. Tujuh pengujian PGlite mencakup cakupan HRD, pusat, aktivasi awal, versi lama, akun nonaktif, anonim, outlet terhapus dan audit. Fixture integrasi `supabase/tests/pos_testing.sql` lulus dan ROLLBACK; tidak membuat transaksi/kas asli. Fitur training lengkap SO/penerimaan barang ditunda sesuai diskusi; pekerjaan ini hanya memperbaiki pengaturan akses mode testing POS yang sudah ada.

Kominot diaktifkan untuk simulasi sesuai permintaan; outlet lain tidak diaktifkan otomatis. Seluruh 236 pengujian awal dan build produksi lulus. Uji role `authenticated` juga memastikan wrapper dapat dipakai tanpa memberi akses schema `matur_internal`.
