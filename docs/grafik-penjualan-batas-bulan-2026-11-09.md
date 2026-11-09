# Batas periode grafik penjualan — 9 November 2026

Grafik SalesView sebelumnya langsung menampilkan seluruh tanggal harian dari RPC. Sebuah baris bertanggal 31 Oktober ikut muncul dalam periode November dan ikut menentukan hari tersepi.

Bawaan dashboard penjualan dan pilihan filter harian sekarang Bulan ini, bukan 30 hari terakhir. Pilihan periode lain tetap tersedia jika dipilih secara eksplisit.

Batasi baris harian grafik menggunakan tanggal awal dan akhir dari filter periode yang sudah ada. Bulan ini tetap tanggal 1 sampai hari berjalan; bulan lampau tetap satu bulan penuh; periode kustom mengikuti rentang pilihan. Daftar seri outlet, tabel grafik, hari teramai/tersepi, dan omzet ekstrem memakai data grafik yang sama setelah disaring.

Tidak mengubah RPC/database, tanggal transaksi, total penjualan 1 November, KPI ringkasan, atau menggabungkan Rp70.000 ke tanggal lain. Baris di luar periode hanya tidak ditampilkan pada grafik periode tersebut. Pengaturan hari operasional tidak diubah.

Uji regresi mencakup batas November, tanggal berjalan, tanggal masa depan, pergantian tahun, bulan lampau, periode kustom, data kosong, dan nominal sumber yang tetap.
