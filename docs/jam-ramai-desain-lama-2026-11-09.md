# Jam Ramai: kembali ke desain sebelumnya — 9 November 2026

Atas koreksi pemilik, gunakan kembali Heatmap lama dengan baris Minggu–Sabtu dan kolom jam operasional (06–02, termasuk jam lain jika ada transaksi), tinggi kotak h-6, radius 3px, gap 2px dan palet HEAT tujuh warna yang sama. Tanggal ditambahkan di bawah label hari. Tidak ada angka di dalam kotak seperti desain baru yang dibatalkan. Hanya tanggal di dalam kelompok aktif yang ditampilkan; urutan baris tetap Minggu–Sabtu.

Kelompok 1–7, 8–14 dan seterusnya tetap memakai data tanggal yang sudah ada. Panel membuka kelompok pertama; panah periode pindah kelompok tanpa mengubah filter dashboard. Gestur swipe yang sebelumnya mengganti periode dibuang dari area kotak, sehingga geser sentuh asli/browser kembali menggeser kolom jam. Tersedia tombol geser kolom jam dan fokus keyboard; label hari tetap terlihat di kiri saat digeser. Tombol geser jam dinonaktifkan ketika sudah di batas/tidak ada overflow.

Perbaikan penting: toolbar periode sekarang berada di slot ChartCard yang tetap terlihat saat data kosong, error, maupun mode tabel. Sebelumnya ChartCard menyembunyikan children saat rows kosong, sehingga panel bisa terkunci pada kelompok tanpa data. Slot baru bersifat opsional dan perilaku default kartu lain tetap sama. showEmptyContent khusus panel ini menampilkan heatmap kosong atau pesan kegagalan yang sesuai.

Tidak mengubah database, RPC, aturan tanggal operasional, penjualan, atau riwayat. Heatmap lain mempertahankan urutan dan label defaultnya.

QA browser pada komponen asli dengan data dummy: urutan hari dan tanggal, kotak lama, native mobile touch scroll melalui Chromium Input.dispatchTouchEvent, tombol geser jam, panah periode, tanggal batas, perpindahan keluar dari kelompok kosong, navigasi saat mode tabel, serta tanpa overflow halaman pada 1440/390/320 px. Fixture dan bypass middleware tidak disertakan.

Pemeriksaan akhir: TypeScript dan ESLint tanpa error, 435 tes pada 72 file, dan build produksi berhasil.
