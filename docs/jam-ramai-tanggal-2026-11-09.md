# Jam Ramai per tanggal — 9 November 2026

Panel Jam Ramai pada SalesDashboard sekarang memakai tanggal operasional dan jam WIB, bukan gabungan hari Senin–Minggu dari seluruh periode. Kelompok kalender 1–7, 8–14, 15–21, 22–28, dan 29–akhir bulan. Batas bulan/periode pilihan tetap dipatuhi; bulan berjalan sampai tanggal berjalan. Rentang kustom lintas bulan membuat kelompok baru saat berganti bulan. Panel membuka kelompok terakhir dalam periode, lalu panah kiri/kanan atau swipe horizontal memilih kelompok sebelumnya/berikutnya. Pergantian outlet/periode mereset pilihan.

Maksimal tujuh kolom, label hari mengikuti tanggal sebenarnya; baris jam WIB, warna dan angka jumlah transaksi, rincian dapat diketuk/difokuskan. Ringkasan jam tersibuk dan tabel rincian mengikuti kelompok aktif yang sama. Batas panah dinonaktifkan; tidak ada tanggal bulan berikutnya yang disisipkan.

RPC baca `jam_penjualan_tanggal(uuid,date,date,mode_data)` memakai SECURITY INVOKER, search_path kosong, SELECT/RLS transaksi dan filter visibilitas outlet yang sama dengan ringkasan penjualan. Eksekusi hanya authenticated, tetap memeriksa sesi, tidak membuka akses lintas outlet. Tidak mengubah fungsi ringkasan, nominal, status pembayaran, stok, atau riwayat transaksi. `tgl_op` mempertahankan aturan tengah malam yang telah berlaku. Catatan impor `sumber_penjualan` tanpa waktu tidak dipakai untuk menebak jam dan ditampilkan keterangannya.

Migrasi `20261109034501_jam_penjualan_tanggal.sql` dibuat via CLI v2, diterapkan dan dicatat pada riwayat migrasi. Uji fixture PGlite: tanggal 1 November tetap kalender, transaksi dini hari masuk tanggal operasional sebelumnya, tanggal 1 dan 8 tidak digabung, impor tanpa jam dikecualikan, void/mode lain dikecualikan, outlet tersembunyi dan RLS dihormati, anon ditolak. Uji baca produksi sebagai authenticated dijalankan dalam transaksi ROLLBACK; hasil hanya berisi tanggal dalam periode. Fungsi invoker, anon tidak punya EXECUTE, authenticated punya EXECUTE. Security advisor tidak bertambah dari baseline.

Uji browser memakai data dummy pada komponen asli: panah, batas tanggal, rincian sel, tabel sesuai rentang, swipe, tanpa overflow pada desktop 1440 px dan HP 390/320 px, tanpa page error. Fixture/middleware khusus QA tidak disertakan dalam perubahan.

Pemeriksaan akhir: TypeScript, ESLint tanpa error, 435 tes pada 72 file, dan build produksi berhasil.
