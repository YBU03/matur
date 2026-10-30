# Accounting, pembelian langsung dan titipan — 30 Oktober 2026

## Menu

- POS → Kas & Pengeluaran: Internet/Wifi sudah dapat dipilih. Semua kategori tetap dicatat melalui RPC pengeluaran yang sama.
- Pilih Bahan Baku → Rincian bahan untuk pembelian langsung di luar Gudang. Isi jumlah dalam satuan stok (gram/ml/pcs sesuai master). Setelah disimpan, biaya masuk Accounting sekali dan dibuat penerimaan yang menunggu pengecekan.
- POS → Kas & Pengeluaran atau Stok Outlet; akun barista → Stok Outlet: panel Penerimaan pembelian langsung. Periksa setiap bahan dan jumlah diterima; catat kekurangan/rusak/tidak sesuai. Konfirmasi final menambah stok hanya sebesar jumlah yang diterima. Retrying tidak menambah stok lagi. Hasil penerimaan tersimpan bersama nama akun penerima, waktu dan catatan. Akun POS bersama dicatat sebagai akun outlet; untuk nama personal gunakan akun barista.
- Accounting → Catatan Harian → buka tanggal → daftar kas → Revisi aktual. Owner/Admin Pusat/Finance dapat merevisi uang fisik final termasuk modal pada kas tim; setoran neto dan selisih dihitung ulang. Kas lama menggunakan nominal setoran tanpa pengurangan modal kedua. Alasan wajib dan riwayat sebelum/sesudah terlihat. Transaksi POS dan tutup shift individual tidak diubah. Kas dengan antrean offline tertunda belum dapat direvisi.
- Titipan Produk: pilih Harian/Mingguan/Per 10 Hari/Bulanan/Kustom. Per 10 Hari menyediakan bagian 1–10, 11–20, 21–akhir bulan (otomatis mengikuti Februari/tahun kabisat). Kustom memilih tanggal mulai dan akhir inklusif, maksimal 366 hari. Klik Terapkan untuk memuat hasil; rentang pilihan terlihat sebelum diterapkan dan rentang hasil tetap tertera di rekap. Rentang yang diterapkan dipertahankan saat berganti outlet. Minggu Senin–Minggu, termasuk lintas bulan. Stok awal kumulatif, masuk, retur/rusak/koreksi negatif, keluar POS/marketing, sisa dan nilai tagihan dari harga produsen saat ini. Ini rekap nilai kewajiban periode, bukan bukti pelunasan. Perhitungan HPP bulanan yang sudah ada tetap menggunakan jalur sebelumnya.

## Hubungan data

Pengeluaran Bahan Baku menyumbang pembelian ke persediaan_bulanan sekali. Konfirmasi penerimaan hanya menambah mutasi/stok, tanpa membuat biaya atau kiriman gudang baru. Kiriman gudang tetap menggunakan terima_kiriman yang sudah tersedia; jangan input pembayaran invoice gudang sebagai pembelian langsung lagi. Laporan bulanan yang sudah diterbitkan tidak ditimpa otomatis.

Rincian penerimaan dibekukan ketika dicatat. Nominal/kategori/tanggal/outlet/penghapusan biaya terkait dilindungi agar tidak memutus riwayat stok. Koreksi atas penerimaan final dilakukan lewat pencatatan koreksi stok yang berwenang, bukan mengulang penerimaan. Belum mendukung beberapa tahap penerimaan untuk satu pembelian langsung; semua baris diperiksa dalam satu konfirmasi final. Histori panel outlet menampilkan 100 pembelian terbaru, Accounting sesuai bulan.

## Keamanan & verifikasi

Semua tabel baru RLS, authenticated hanya SELECT sesuai peran/outlet. Mutasi memakai wrapper SECURITY INVOKER ke fungsi privat berotorisasi. Tidak ada akses anon, perubahan izin POS, absensi, PIN atau switch shift. Idempotensi uang memakai request_id yang sama, penerimaan row lock; snapshot aktual diperiksa sebelum revisi untuk menolak edit bersamaan.

Tests: PGlite untuk uang/stok sekali, bahan invalid, kekurangan/nihil penerimaan, akses Accounting/outlet, optimistic concurrency, audit, kas lama, hari WIB dan titipan tanpa simulasi. supabase/tests/accounting_operasional.sql menjalankan jalur dengan RLS authenticated dan data terisolasi lalu ROLLBACK, termasuk persediaan_bulanan tidak menggandakan pembelian.
