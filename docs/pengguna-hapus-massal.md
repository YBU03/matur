# Konfirmasi dan hapus beberapa pengguna

Penghapusan tetap khusus Owner. Menu Pilih Pengguna menampilkan checkbox pada hasil tab/pencarian/outlet saat ini, dengan akun sendiri dan Owner tidak dapat dipilih. Perubahan filter mengosongkan pilihan agar pengguna tersembunyi tidak ikut terhapus. Pilih semua dibatasi 100 akun per proses dan diberi label eksplisit bila hasil filter lebih besar.

Satu akun: ketik `Yakin Hapus`, lalu nama pengguna persis. Beberapa akun: ketik `Yakin Hapus`, lalu `HAPUS N PENGGUNA`. Dialog menampilkan nama dan email akun sebelum pengiriman. Server memeriksa konfirmasi lagi menggunakan data terbaru, ID unik/valid, batas 100, peran Owner, akun sendiri, Owner target, dan akun tablet. RPC database memeriksa ulang kewenangan untuk setiap akun. Proses dikunci terhadap kiriman ulang dan hasil dilaporkan per akun. Kegagalan satu akun tidak menyembunyikan keberhasilan akun lain. Gangguan koneksi menghentikan pengiriman berikutnya; hasil yang belum pasti ditandai agar admin memuat ulang daftar sebelum mengulang.

## Perlindungan riwayat

Fungsi hapus lama hanya memeriksa sebagian relasi sebelum menghapus Auth user, padahal absensi, jadwal, pengaturan gaji, slip gaji dan beberapa tabel lain memakai ON DELETE CASCADE. Migrasi baru memeriksa seluruh FK yang mengarah ke ID pengguna, kecuali penugasan, sebelum menentukan hapus permanen atau arsip. Akun dengan referensi aplikasi diarsipkan: status dihapus, peran dicabut, Auth diblokir dan sesi/refresh token dihapus; data riwayat serta tautannya dipertahankan. Penanggung jawab outlet dikosongkan agar tidak tetap menunjuk akun yang dinonaktifkan. Akun yang benar-benar tanpa referensi lain dapat dihapus permanen. Setiap penghapusan mendapat log aktivitas Owner.

Target pengguna dikunci FOR UPDATE sebelum memeriksa riwayat sehingga penambahan FK bersamaan tidak hilang akibat cascade. Fungsi memakai search_path kosong, nama schema eksplisit, pengecekan Owner aktif, dan grant terbatas. Advisory authenticated SECURITY DEFINER untuk RPC ini disengaja dan dilindungi pengecekan akses internal.

## Verifikasi

- Build produksi dan diff check lulus; warning lint lama simulasi-view.tsx tetap ada.
- Delapan tes server action lulus: role, konfirmasi, ID/batas batch, akun terlindungi, hasil parsial, gangguan koneksi (termasuk respons transport PostgREST status 0), dan hapus tunggal.
- `supabase/tests/hapus_pengguna_riwayat.sql` lulus dengan fixture transaksi ROLLBACK: Owner-only, larangan self/Owner/tablet, hapus akun tanpa riwayat, arsip dan retensi absensi/gaji/slip, pemblokiran login, pencabutan peran, audit dan privilege.
- Security advisors ditinjau. Tidak ada akun pengguna produksi yang dihapus dalam pengujian. UI browser produksi belum diuji.
