# Tabel Harian 26 kolom — 6 November 2026

Urutan bawaan: Tanggal; Keterangan; Tunai; Non Tunai; Go food; Grabfood; Tiktok Go; Ruma App; Shopee Food; Discount; Es Kristal; Bahan Baku; Biaya Galon; Sewa Outlet; Listrik; Internet; Air; Maintenance; B. Gaji; Biaya Perlengkapan; Biaya Pemeliharaan Lingkungan; Lain Lain; Reimburse; Sedekah; Distribusi; Marketing.

Semua kolom utama tampil meskipun kosong. Pengeluaran dipetakan ke ID kategori yang sudah ada; label tabel tidak mengganti nama master atau membuat duplikat kategori. Keterangan berasal dari jumlah shift dan uraian pengeluaran, tidak menyimpan catatan rekaan. Teks lengkap muncul di bar keterangan saat sel dipilih.

Setelah Marketing: Total Penjualan, Total Pengeluaran, Kas Seharusnya, Setoran Aktual, Selisih Kas. Angka kas berasal dari rekap sesi yang sudah ada, bukan hasil mengurangi seluruh pengeluaran dari seluruh kanal penjualan. Tidak membuat kolom laba usaha dari sisa kas. Total penjualan mengurangi diskon sekali dan tetap memasukkan Tumbler meskipun kolom itu tersembunyi. Total pengeluaran memasukkan seluruh kategori. Keterangan bukan angka dan tidak dijumlahkan.

Tumbler, Admin Transfer, Loker, dan kategori tambahan tetap tersedia lewat Atur Kolom, disembunyikan pada susunan bawaan. Geser, tampil/sembunyikan, lebar, penggantian nama kategori, dan susunan bersama akunting tetap memakai mekanisme yang ada. Penggantian nama kategori mempertahankan kolom agar tetap terlihat; nama kustom di luar alias format menjadi kolom tambahan. Susunan bawaan dapat dipulihkan lewat Atur Kolom. Pengeluaran per kategori masih dapat dimatikan secara sengaja. Data master perusahaan saat migrasi memiliki susunan kosong; migrasi tidak menimpa preferensi kolom.

## Sedekah

Migrasi `20261106013245_tabel_harian_26_kolom.sql` menambahkan kategori Sedekah jika belum ada, grup `lain`, harian aktif. Kolom ini hanya menjumlahkan pengeluaran nyata yang dicatat lewat alur pengeluaran yang sudah ada. Grup lain sengaja tidak menambah HPP atau beban proyeksi; alokasi persentase sedekah laporan bulanan tetap terpisah agar tidak dihitung dua kali. Tidak menambahkan pengeluaran/penjualan/nominal otomatis.

## Ekspor

Excel (tabel ini) mengikuti kolom/urutan yang sedang tampil: 26 kolom bawaan ditambah ringkasan kas. Keterangan disimpan sebagai teks; angka tetap numerik. Ekspor format Ruma lama tetap mempertahankan rincian per item, dengan tambahan Kas Seharusnya/Setoran Aktual/Selisih Kas. Kas yang belum ditutup tetap kosong. Selisih 0 tetap 0. Baris Penjualan dikurangi Pengeluaran ditandai bukan laba bersih/HPP.

## Area kerja dan interaksi

Hamburger Menu pada desktop melipat/membuka sidebar dan mengingat pilihan per browser. Laci HP tetap terpisah, bisa ditutup Escape, dan tidak menerima fokus saat tersembunyi; pindah ke desktop menutup laci agar scroll halaman tidak terkunci. Login, peran, dan izin menu tidak berubah. Tanggal/header tabel tetap sticky dan gulir horizontal hanya di wadah tabel.

Bar keterangan desktop memiliki tinggi minimum agar tabel tidak bergeser di antara dua klik ketika jenis sel berubah. Klik pada input tidak merambat ke sel dan membatalkan edit. Klik ganda pengeluaran menggunakan sel yang benar, bukan seleksi sebelumnya.

## Verifikasi

Uji perhitungan mencakup urutan literal 26 kolom, ID kategori, angka kosong, kanal tersembunyi, diskon, dan keterangan. Uji workbook membaca kembali Excel yang dihasilkan: kategori Sedekah, rumus total, kas, serta nilai null.

Browser QA lokal menggunakan komponen asli, data fixture, dan callback aksi tanpa menjalankan penulisan ke database. Desktop 1440 px: 26 judul, angka, klik ganda/Enter edit, pengeluaran, unduhan XLSX, sidebar melebar dan preferensi setelah reload. HP 390/320 px: drawer, Escape, tanpa overflow halaman. File XLSX hasil browser dibaca ulang: 31 kolom (26 utama + 5 ringkasan), total Rp155.000 termasuk Tumbler dan diskon, kas Rp65.000, aktual Rp60.000, selisih -Rp5.000. Halaman QA dan pengecualian middleware dihapus sebelum build.
