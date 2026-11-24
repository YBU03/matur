# Koreksi template Oktober dan pemisahan BEP — 24 November 2026

Laporan berarsip Excel sebelumnya mengganti seluruh tampilan bulanan dengan tabel sel sumber. Kini semua bulan melalui `LaporanDokumen`, dengan kop, KPI/grafik, metadata, HPP, laba rugi, sharing profit, sedekah, alokasi transfer dan tanda tangan yang sama. `laporan-tampilan.ts` menyiapkan metadata sumber dan seri grafik untuk layar maupun PDF; arsip lengkap tetap melekat. Pembanding/tren hanya untuk outlet yang sama sampai bulan laporan, tidak mengambil bulan mendatang.

Sumber Oktober tidak dihapus, dihitung ulang, atau ditulis ke database. Total cached Excel tetap dipakai `hitung`, termasuk total transfer yang berbeda dari jumlah baris. Tabel nominal Oktober mempertahankan pecahan rupiah. Unduh Excel utama mengembalikan workbook asli (termasuk lembar Transaksi), bukan workbook baru yang kehilangan rincian.

Arsip sumber dipindah ke panel Lampiran di bawah laporan, tersedia PDF lengkap dan Excel sumber. Lampiran PDF mempertahankan semua baris dan teks tampilan sumber, memakai nama kolom transaksi agar terbaca, header berulang, margin serta footer seragam dan baris tidak terbelah. Teks kosong sel rumus tidak dicetak ulang sebagai kode teknis. Urutan serta nilai asli tetap dalam arsip dan workbook.

BEP tetap per outlet, sekarang query laporan juga dibatasi `outlet_id` di server, tidak memuat laporan seluruh outlet lalu memfilternya saja. Outlet tidak dikenal/di luar izin ditolak. Nama outlet aktif terlihat pada panel penjelasan dan judul grafik; investasi, laba, alokasi dan link rekap mengikuti pilihan yang sama. Tidak menggabungkan nilai Kominot dan UHB.

Validasi: uji komponen template Oktober/bulan biasa, filter riwayat lintas outlet/bulan mendatang, query BEP dan penolakan ID tidak dikenal, PDF/appendix serta pelestarian snapshot. PDF dari data Oktober aktual dirender (3 halaman utama, 44 halaman termasuk arsip lengkap 85 baris laporan + 751 baris Transaksi); dibandingkan template September. Tidak mengklaim uji klik browser produksi atau printer fisik.
