# Kelola Stok Outlet

Menu `/stok/outlet` tersedia untuk Owner/Admin Pusat/Admin Gudang/SPV (kelola), Finance/HRD/Manajer Area (lihat sesuai cakupan). Outlet berasal langsung dari master outlet asli yang belum dihapus. Outlet baru otomatis dapat dipilih; SPV hanya mengelola outlet penugasannya dan hanya menerima transfer sebagai tujuan. Nama outlet tujuan disediakan terpisah tanpa membuka stok outlet lain.

## Bahan dan stok

- Memakai master bahan dan stok yang sudah ada. Bahan belum diatur tetap mengikuti sistem lama; tambah/aktifkan bahan berarti mengatur keterlibatan bahan master di outlet, bukan menggandakan master. Pembuatan master baru tetap melalui master Bahan oleh Pusat/Gudang.
- Minimum dan status aktif per outlet. Minimum dipakai panel dan pembacaan Stok Real-time. Nonaktif menyembunyikan bahan dari panel pengelolaan/restock baru; tidak menghapus stok, resep, riwayat, SO atau kiriman berjalan. Tampilkan nonaktif untuk memulihkan.
- Koreksi stok mengganti jumlah saat ini, alasan wajib, jumlah sebelum wajib sama dengan stok terbaru yang dikunci. Koreksi dicatat sebagai delta mutasi; tidak mengedit transaksi historis.
- Waste mengurangi jumlah, menolak lebih dari stok, alasan wajib dan foto opsional JPG/PNG/WebP5MB. Bukti privat berdasarkan outlet, signed URL120detik.
- Semua perintah idempotent dengan UUID dan payload; pengulangan identik tidak menggandakan stok/draft. Perubahan payload dengan UUID sama ditolak. Ketidakpastian jaringan menahan identitas di UI sampai ada hasil.

## Restock dan transfer

- Minta 1–50 bahan dalam satuan pakai, pencarian bahan, catatan. Permintaan tidak mengubah stok.
- Gudang memproses sekali menjadi draft kiriman yang ada, mengonversi satuan pakai ke satuan beli berdasarkan konversi valid dan harga gudang sekarang. Proses selanjutnya tetap melalui Kiriman/Penerimaan yang sudah ada; tidak membuat pencatatan biaya atau stok kedua. Status kiriman tampak pada permintaan. Permintaan belum diproses dapat dibatalkan. UI menampilkan100permintaan terbaru pada cakupan outlet yang dipilih.
- Transfer menunggu belum mengubah stok. Konfirmasi tujuan/Pusat mengunci stok secara berurutan, memeriksa kecukupan semua bahan, lalu mengurangi asal dan menambah tujuan secara atomik. Batal/tolak sebelum diterima tidak mengubah stok. Pengulangan konfirmasi tidak menggandakan mutasi. Perubahan satuan/nonaktif master ditolak. Untuk mengganti isi transfer, batalkan lalu ajukan kembali.
- Tab transfer menu `/gudang/mutasi` mengarah ke panel baru. Riwayat transfer lama tetap terlihat, fungsi legacy tidak dipanggil UI baru.

## Laporan penggunaan dan kartu bahan

Pilih satu/semua outlet yang berwenang, bahan dan rentang hari ini/kemarin/7/30hari/bulan ini/kustom maksimal366hari. Mengikuti `tgl_op`/`awal_op` (03.00WIB sesuai kebijakan existing), bukan tanggal kalender untuk bagian transaksi tengah malam.

Stok awal/akhir direkonstruksi dari stok sekarang dan riwayat mutasi tersimpan. Tampilkan batas awal ketersediaan riwayat, jangan menganggap saldo rekonstruksi sebagai bukti fisik historis. Ringkasan memisahkan masuk, pemakaian teoritis resep POS, kembali void, waste, marketing, penyesuaian SO, koreksi dan keluar lain. SO bukan otomatis pemakaian fisik; peringatan membuka kartu bahan, kemudian koreksi stok saat ini/SO baru jika diperlukan. Tidak ada nominal biaya baru, penjumlahan lintas satuan, atau perubahan ke akunting.

Riwayat berhalaman500baris dengan kursor waktu+ID. Ekspor mengambil semua halaman sebelum mengunduh, mempertahankan batas waktu baca agar mutasi baru tidak menyusup di awal ekspor. PDF A4landscape berisi ringkasan+riwayat dan nomor halaman; XLSX memiliki sheet Ringkasan/Riwayat mutasi dengan angka sebagai angka, filter dan frozen headers. Gagal mengambil halaman membatalkan ekspor, tidak mengunduh laporan sebagian. Riwayat pengaturan minimal/aktif memperlihatkan waktu, petugas dan alasan100terbaru dalam rentang.

## Implementasi dan verifikasi

Tabel setelan_stok_outlet, permintaan_stok_outlet dan transfer_stok_terima RLS baca sesuai outlet, tanpa grant tulis langsung kepada authenticated. RPC melalui stok_outlet_internal menguji pengguna aktif, peran/cakupan dan validasi setiap tindakan; tidak ada service-role dalam aplikasi. Bukti memakai bucket privat stok-outlet-bukti. Index per outlet/waktu pada mutasi dan indeks FK baru. Migrasi tidak mengubah nilai stok atau mutasi lama.

Uji PGlite alur/perizinan/duplikasi/stale/shortage/pagination/outletbaru; DOM React untuk stok saat ini terpisah filter laporan, akses baca, restock/transfer; helper tanggal dan export mapping; minimum realtime; regression sidebar/forecast/hari operasional/kiriman. Dry-run produksi semua mutasi di-ROLLBACK. Ekspor nyata Kominot20Nov:33bahan,319mutasi; Excel dibaca ulang, PDF16halaman dirender/diperiksa. Tidak menguji printer/tablet fisik atau browser produksi secara langsung.
