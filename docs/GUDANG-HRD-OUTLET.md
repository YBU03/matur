# Gudang, HRD, profil outlet, dan pilihan QRIS

Perubahan ini membutuhkan migrasi `0055_gudang_hrd_outlet.sql` sebelum aplikasi baru digunakan. Migrasi belum diterapkan ke database produksi oleh perubahan kode ini.

## Perilaku

- Gudang/Owner/Admin Pusat dapat menambah HPP dengan bahan dari gudang dan takaran satuan pakai. Menu POS baru, HPP, dan resep disimpan dalam satu transaksi database. Menu yang sudah punya resep tidak ditimpa. Untuk resep Hot/Can berbeda gunakan menu POS tersendiri; varian resep berbeda belum dikelola melalui form tambah ini. Finance tetap hanya membaca.
- Overview HRD menampilkan staf terjadwal, status hadir/telat, waktu masuk/pulang, dan izin hari ini per outlet. Data mengikuti jadwal terbit; draft tidak dianggap jadwal staf.
- Edit/hapus absensi melalui RPC dengan alasan dan audit sebelum/sesudah. Status telat dihitung ulang sesuai jam shift dan toleransi perusahaan. Jam menggunakan WIB dan tetap mendukung shift melewati tengah malam. Penggajian asli yang final mengunci edit/hapus; draft yang sudah dihitung perlu dihitung ulang sesudah perubahan. Foto asli tidak ditimpa ketika waktu diedit; referensinya tersimpan dalam audit saat absensi dihapus.
- Persetujuan dibagi menjadi Izin/Sakit/Libur, Tukar Shift, dan Riwayat.
- Kepemilikan outlet dapat diisi Pusat, Mitra, atau jenis lain. Data Usman Janatin asli ditandai Pusat oleh migrasi. Perjanjian dan laporan historis tidak diubah. Edit Profil Outlet tersedia bagi Owner/Admin Pusat.
- QRIS statis memakai gambar/payload yang diunggah; kasir tetap memeriksa dana masuk. Membaca gambar tidak mengganti pilihan mode.
- Mode QRIS dinamis menyimpan nama penyedia dan Merchant ID untuk persiapan. **Belum ada adapter penyedia, API key, webhook, atau konfirmasi otomatis**. Status selalu menunggu konfigurasi; pembayaran QRIS pada mode ini ditolak oleh server action dan trigger database, termasuk split payment. Pilih Statis untuk tetap menerima QRIS manual. Informasi rahasia API kelak harus disimpan di server, bukan kolom outlet.

## Penerapan

1. Periksa kesesuaian database live dengan migrasi 0001–0054. Repo lama mencatat beberapa perubahan RPC dilakukan langsung pada database, khususnya transaksi/pemotongan resep; kondisi live belum diverifikasi di sini.
2. Terapkan 0055, lalu deploy kode dari branch perubahan. Migrasi menambah kolom, fungsi, dan trigger, menandai Usman Janatin, serta membatasi mutasi langsung tabel absensi agar melalui RPC audit. Migrasi tidak menjalankan transaksi POS atau menghapus absensi lama.
3. Uji memakai akun Gudang/HRD/Owner/SPV di staging: tambah menu dan HPP, jual di POS, pastikan stok bahan berkurang; edit/hapus absensi dan periksa rekap/audit; cek batas outlet SPV; pilih QRIS statis dan dinamis; edit profil outlet. Verifikasi pada database nyata tetap diperlukan untuk fungsi POS lama.

## Validasi lokal

`npm test` mencakup tes PostgreSQL via PGlite yang menjalankan migrasi 0055 dengan fixture skema sebelumnya. Tes meliputi transaksi atomik HPP, resep, harga dari database, penolakan hak akses, QRIS menunggu konfigurasi, keterlambatan, audit hapus, dan gaji final. Fixture ini tidak menggantikan verifikasi database produksi dan integrasi provider pembayaran.


## Status penerapan 15 Oktober 2026

Migrasi `0055_gudang_hrd_outlet` berhasil diterapkan ke proyek matur (`qocejvxjfrmlpnejtcwh`), versi `20261015024627`. Pembatasan akses fungsi trigger QRIS juga diterapkan lewat migrasi `gudang_hrd_qris_trigger_privileges` (baris REVOKE disertakan pada akhir skrip 0055 untuk instalasi baru).

Kolom kepemilikan dan konfigurasi QRIS, fungsi HPP/resep dan edit absensi, serta trigger pembayaran terverifikasi. Usman Janatin berstatus Pusat; QRIS kedua outlet tetap statis. Uji transaksi nyata ke fungsi baru (tambah menu/HPP/resep, simpan QRIS pending, edit/hapus absensi dan audit) berhasil dan di-ROLLBACK seluruhnya. Jumlah menu 36, resep 88, HPP 30, absensi 1, transaksi 3393 dan pembayaran 3393 tetap sama; menu uji tidak tersisa.

Kode UI masih berada pada PR #1 dan belum dimerge/deploy. Kebijakan mutasi langsung absensi telah diganti dengan RPC audit: tombol Koreksi dari versi aplikasi lama perlu kode PR ini agar kembali menggunakan jalur baru. Integrasi penyedia QRIS otomatis tetap menunggu penyedia/kredensial/webhook.

Advisor keamanan memverifikasi fungsi mutasi baru tidak dapat dijalankan secara anonim. Fungsi trigger QRIS juga tidak dapat dipanggil langsung oleh role authenticated, tetapi trigger tetap aktif. Temuan lama pada helper/ekstensi/Auth berada di luar lingkup migrasi ini.
