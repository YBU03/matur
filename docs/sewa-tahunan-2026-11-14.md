# Sewa perjanjian tahunan

Input Perjanjian Mitra menggunakan Sewa Tahunan. Form menampilkan nilai tahunan dibagi 12 dengan dua desimal; rincian outlet menampilkan keduanya. Proyeksi berikutnya memakai nilai bulanan yang dibulatkan ke rupiah penuh, mengikuti format laporan yang ada. Laporan tersimpan tidak dihitung ulang.

Data asli yang dikonfirmasi pemilik: Kominot Rp17.000.000/tahun (Rp1.416.666,67/bulan), UHB Rp25.000.000/tahun (Rp2.083.333,33/bulan). Migrasi memperbaiki kedua perjanjian tersebut tanpa mengubah investasi, rasio bagi hasil, atau pilihan Sewa dihitung BEP. Ini bukan pencatatan pembayaran sewa dan tidak mengurangi kas proyek.

Kolom sewa_tahunan menjadi acuan. Kolom sewa_bulanan tetap disinkronkan sebagai rupiah bulat untuk kompatibilitas klien lama. Pembaruan kolom lain tidak mengubah nilai tahunan menjadi hasil perkalian nilai bulanan yang telah dibulatkan. Trigger memakai security invoker dan tidak mengubah RLS.

Validasi: 509 tes pada 87 berkas lulus, termasuk 7 tes konversi/SQL. Form asli diuji dengan data contoh: Rp17 juta dan Rp25 juta menghasilkan nilai bulanan yang sesuai. ESLint pada berkas perubahan tidak memiliki error; terdapat satu peringatan useMemo lama pada proyeksi-form. Migrasi dicoba dengan rollback sebelum diterapkan dan data produksi diverifikasi sesudahnya.
