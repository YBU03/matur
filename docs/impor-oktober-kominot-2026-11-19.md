# Impor laporan Oktober Kominot — 19 November 2026

Pemilik menyetujui pemetaan nama sumber Ruma Kopiaksa ke outlet Ruma Kopi Kominot dan koreksi Transaksi!A31 dari 2 September ke 2 Oktober 2026. Workbook sumber tetap utuh; judul sumber yang tertulis April/Machiro dipertahankan dengan catatan perbedaan.

## Data dan batas publikasi

- Catatan Harian: 31 tanggal, 248 isian kanal (termasuk nol), 652 rincian biaya; penjualan Rp87.553.000 dan biaya Rp58.330.473. Tidak membuat transaksi POS atau sesi kas fiktif.
- Laporan internal: pendapatan termasuk penyesuaian ojol Rp88.535.871, HPP Rp38.703.490, laba bersih cached Excel Rp28.073.805,81.
- Snapshot laporan_internal mempertahankan nilai desimal, hasil rumus, nomor sel, format tampilan, kas aktual dan selisih sumber, metadata koreksi, serta workbook asli base64 dengan SHA-256. Tidak memasukkan nilai desimal ke kolom bigint laporan resmi.
- Belum diterbitkan ke Mitra; buka_at null. Pembaca snapshot sumber dipakai pada Periksa Internal dan preview internal, tanpa menjalankan editor proyeksi yang membulatkan dan menghitung ulang.
- Tampilan sumber bersifat baca dan unduh. Publikasi/revisi melalui editor biasa tidak disediakan untuk snapshot sumber ini, agar presisi dan arsipnya tidak terbuang. Publikasi laporan sumber memerlukan pengembangan dukungan presisi pada tabel resmi terlebih dahulu.

## Pemeriksaan

Impor memakai satu transaksi SQL dengan role authenticated dan pemeriksaan peran, penolakan data Oktober yang sudah ada, hash workbook dan total sumber. Dry run ROLLBACK sebelum COMMIT. Setelah COMMIT seluruh 248 isian kanal dan 652 rincian biaya dicocokkan per baris, kategori, tanggal, nominal dan keterangan. Snapshot keuangan cocok per field, hash file sumber cocok, kas aktual sumber Rp24.757.755.

Data dan skrip impor privat berada di handoff lokal; tidak dimasukkan Git. Aplikasi hanya memperoleh arsip melalui query laporan_internal yang sudah dibatasi RLS Owner/Admin Pusat/Finance. SPV tetap melihat Catatan Harian sesuai kewenangan, tidak memperoleh arsip keuangan pribadi.

PDF lengkap memakai seluruh 3.542 sel berisi yang disajikan dari dua lembar sumber (bagian transaksi sampai footer pertama baris 765; template kosong footer kedua tidak disajikan dan tetap ada dalam file Excel asli). Nilai presisi dan rumus tersedia di rincian layar/Excel; PDF mengikuti tampilan nominal Excel. PDF 46 halaman diperiksa ekstraksi seluruh sel dan render.

Pencocokan kategori impor diperbaiki: Lain-lain tidak boleh memilih kategori tak dikenal seperti Admin Transfer hanya karena kolom fallback ekspornya sama.
