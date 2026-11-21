# Penerbitan laporan sumber Excel

Laporan Oktober Kominot diterbitkan atas instruksi pemilik 21 November. Gunakan RPC simpan_laporan_internal (jadwal sekarang) lalu setujui_laporan_mitra dengan versi/fingerprint, bukan menyalin draft langsung ke publik.

Kolom nominal resmi menjadi numeric agar desimal sumber tidak dibulatkan saat publikasi. Arsip sumber_excel ikut disalin pada penerbitan dan revisi. Kebijakan RLS/jadwal tidak diubah. Arsip besar hanya dimuat pada detail laporan, bukan seluruh daftar/dashboard. Detail sumber resmi mendukung PDF format bulanan yang sama, PDF lengkap dan Excel asli; PDF resmi tidak memiliki penanda draft. Draft tetap privat.

BEP tetap memakai laporan resmi satu baris per outlet/periode dan laba_bersih tersimpan. Tidak memasukkan draft bersamaan atau mengubah formula investasi. Tidak mengubah transaksi harian/bulan lain.

Verifikasi: uji SQL PGlite publikasi/revisi/versi/duplikasi, unit laporan/sumber/PDF; dry-run produksi ROLLBACK membandingkan seluruh nilai snapshot dan arsip serta memastikan laporan lain identik. Tiga halaman PDF resmi sumber Oktober dirender dan diperiksa. TypeScript dan ESLint lulus. Akses mitra dan angka BEP diperiksa setelah publikasi.
