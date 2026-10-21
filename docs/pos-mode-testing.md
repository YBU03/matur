# Mode Testing POS Outlet Demo

Login tetap menggunakan akun POS outlet. Ketika flag testing aktif, `/pos` mengarahkan tablet ke `/pos/testing` tanpa mensyaratkan jadwal, Clock In, PIC, modal, atau sesi kas. Halaman terminal tablet juga dialihkan. Katalog hanya diberikan kepada akun tablet yang memiliki token perangkat aktif dan kredensial outlet yang masih berlaku.

Kontrol aktif/nonaktif tersedia pada Pengaturan POS untuk owner/admin pusat. Kewenangan diperiksa kembali di database menggunakan pengguna aktif dan penugasan aktual, bukan user_metadata. Perubahan memiliki guard versi dan audit `atur_testing_pos`. Allowlist privat `matur_internal.pos_testing` hanya diisi untuk outlet demo yang sudah ada (`demo.pos`); tidak ada tombol untuk mengaktifkan testing outlet produksi. RLS aktif tanpa policy dan tanpa grants langsung untuk anon/authenticated sengaja menutup tabel privat; RPC SECURITY DEFINER dengan search_path kosong dan pemeriksaan akses merupakan satu-satunya jalur aplikasi.

Keranjang memakai perhitungan simulasi lokal. Pembayaran latihan tidak memanggil endpoint transaksi, shift, persediaan, atau setoran dan tidak menyimpan antrean offline. Data latihan hilang ketika halaman dimuat ulang. Komponen struk dipakai bersama POS asli, dengan tanda `TESTING · BUKAN TRANSAKSI ASLI` pada tampilan, WhatsApp, dan ESC/POS. Cetak browser, Bluetooth, RawBT dan pilihan 58/80 mm tetap mengikuti dukungan perangkat/browser yang sama seperti POS biasa.

Database menolak checkout asli baru dari outlet yang sedang testing, termasuk tab lama. Antrean offline dari sebelum waktu aktivasi tetap melewati pemeriksaan izin/sesi lama agar riwayat tidak hilang. Menonaktifkan testing mengembalikan aturan normal; klien online memeriksa flag tiap 15 detik dan ketika tab dibuka kembali. Dalam keadaan offline halaman latihan yang sudah terbuka dapat tetap menghitung lokal, tetapi tidak menulis transaksi asli.

Migrasi awal mengaktifkan flag untuk Outlet Demo sesuai permintaan testing. Data absensi, transaksi, sesi kas, dan password yang sudah ada tidak diubah.

## Verifikasi

- Build produksi lulus; peringatan lint lama pada simulasi-view tetap ada.
- Tujuh tes perhitungan simulasi dan transport printer tiruan lulus.
- `supabase/tests/pos_testing.sql` lulus dengan fixture dalam transaksi ROLLBACK: batas outlet demo, kewenangan admin, token/akun perangkat, katalog tanpa shift, perubahan versi/audit, menonaktifkan mode, penolakan penjualan asli baru, jalur sinkronisasi historis, dan tidak adanya sesi/transaksi keuangan baru.
- Security advisors ditinjau. Advisory tabel privat tanpa policy dan RPC SECURITY DEFINER tersebut disengaja serta dibatasi grants dan pemeriksaan akses di dalam fungsi.
- Printer fisik dan sesi browser pengguna belum diuji; tes transport memakai printer tiruan.
