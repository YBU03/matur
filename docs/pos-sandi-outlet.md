# Sandi POS outlet

Password POS outlet tetap diverifikasi menggunakan bcrypt. Salinan yang dapat dibuka admin disimpan melalui Supabase Vault (enkripsi terautentikasi), dengan UUID referensi di schema privat `matur_internal`. Password tidak dikirim bersama daftar outlet dan tidak dimasukkan ke log aktivitas.

Tombol **Lihat sandi** mengambil sandi melalui RPC tersendiri setelah pemeriksaan pengguna aktif dan kewenangan outlet (`admin_pos_outlet`). Owner/admin pusat mengikuti akses pusat; HRD/admin gudang mengikuti penugasan outlet yang sudah berlaku. Pembukaan dicatat sebagai `lihat_sandi_pos_outlet`. Dialog menghapus sandi dari state saat ditutup, setelah 60 detik, atau saat tab ditinggalkan. Tidak menggunakan localStorage atau sessionStorage.

Sandi lama yang hanya tersedia sebagai hash belum dapat ditampilkan. Login POS berikutnya yang berhasil menyimpan salinan terenkripsi secara otomatis, tanpa mengganti password/hash/versi akses. Alternatifnya admin dapat memasukkan password yang sama; sistem memeriksa kecocokan hash dan versi akses sebelum menyimpannya. Percobaan salah mengikuti batas login 8 kali per 15 menit. Tidak perlu mengganti password. Password baru dari Tambah/Edit langsung tersimpan di Vault.

Perubahan hash atau penghapusan akses menghapus secret lama melalui trigger, termasuk bila dilakukan melalui jalur lain. Helper penyimpanan dan trigger tidak dapat dieksekusi langsung oleh anon/authenticated; schema privat dan Vault tidak diberikan akses langsung ke kedua role tersebut. RPC baru sengaja SECURITY DEFINER untuk mengakses Vault privat, dengan search_path kosong dan pemeriksaan kewenangan di dalam fungsi. Advisory `authenticated_security_definer_function_executable` untuk kedua RPC merupakan konsekuensi yang disengaja; tidak mengizinkan pembacaan oleh sembarang pengguna terautentikasi.

## Verifikasi

Jalankan `supabase/tests/pos_outlet_sandi.sql` setelah migrasi pada database yang memiliki admin pusat aktif. Tes menggunakan outlet/akun/sandi dummy dalam transaksi yang selalu ROLLBACK: enkripsi, audit tanpa isi sandi, kewenangan HRD, akun nonaktif/barista/tanpa identitas, penyimpanan sandi lama, versi, pembatasan percobaan, login POS otomatis, edit tanpa sandi, pergantian dan penghapusan secret, serta grants. Tidak mencetak sandi outlet sebenarnya.

Build produksi dan tes Vitest juga dijalankan. Pengujian browser dengan akun produksi tidak dilakukan.
