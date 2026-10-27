# Revisi gudang 27 Oktober 2026

## Menu dan penggunaan

- **Bahan & Stok Gudang** menampilkan harga beli, harga jual per kemasan, margin per kemasan dan tombol Edit harga. Preview harga baru dikonfirmasi dahulu. Harga kiriman yang sudah dibuat tetap, tidak ditimpa perubahan master. Excel stok menyertakan harga jual/margin.
- **Opname Gudang** khusus Gudang Pusat, bukan outlet. Buat draft untuk mengambil stok sistem saat itu, isi jumlah fisik dalam satuan pakai (gram/ml/pcs sesuai bahan), lalu simpan draft dan finalisasi setelah memeriksa selisih. Isian kosong tidak diubah; nol berarti benar-benar habis. Draft dapat dibuka kembali atau dibatalkan tanpa mengubah stok. Alasan selisih dapat ditulis per bahan atau di catatan. Stok yang bergerak sejak draft dibuat wajib dihitung ulang melalui draft baru. Tidak merekonstruksi stok masa lalu; dampak laba mengikuti waktu finalisasi. Hasil dapat diunduh PDF.
- **Laba Rugi Gudang** memakai barang baik yang diterima, termasuk penerimaan sebagian, berdasarkan waktu penerimaan WIB. HPP disimpan per kemasan saat kiriman baru dikirim. Laba kotor adalah penjualan dengan HPP lengkap dikurangi HPP tersebut. Biaya operasional dicatat sekali di menu ini, bisa dialokasikan ke outlet atau umum. Biaya dapat dibatalkan dengan alasan tanpa menghapus arsip. Penyesuaian opname dan waste gudang memakai HPP snapshot pergerakan. Pembelian persediaan tidak langsung dibebankan seluruhnya.
- Laporan bisa difilter periode (maksimal 366 hari), outlet dan bahan, serta diekspor CSV/PDF. Filter outlet menghitung kontribusi sebelum biaya umum; filter bahan tidak mengalokasikan biaya operasional. Pendapatan internal outlet Pusat ditunjukkan terpisah; ini laporan manajemen gudang, tidak otomatis menambah laba konsolidasi atau membuat transaksi bank/pembayaran.
- Kiriman lama tanpa snapshot HPP tetap tampil penjualannya dan ditandai **HPP belum lengkap**. Laba yang diketahui tidak memasukkan pendapatan yang HPP-nya belum diketahui, sehingga biaya nol tidak diasumsikan. Tidak menghitung ulang menggunakan harga bahan hari ini.

## Surat jalan dan invoice

Empat kotak tanda tangan: Dibuat oleh, Diperiksa oleh, Dikirim oleh, Diterima oleh; masing-masing ruang tanda tangan, nama dan tanggal. Pembuat baru disimpan dari akun pembuat; dokumen lama mengambil identitas akun pembuat jika tersedia. Pemeriksa diisi sebelum kiriman dikirim melalui form yang diaudit. Penerima mengikuti data pemeriksaan outlet. Kotak kosong tetap untuk tanda tangan manual; sistem tidak mengarang tanda tangan digital.

**Pengaturan cetak 3 rangkap** tersedia di detail kiriman draft maupun layar invoice/penerimaan. Preset A4, continuous 9,5 × 11 inci dan 9,5 × 5,5 inci, serta ukuran sendiri (lebar 180–330 mm, tinggi 130–420 mm). Default A4, satu set NCR. Pilih sesuai jenis kertas/printer dan skala 100%/ukuran asli:

- NCR tiga lapis: PDF satu set, cetak satu kali. Jangan memilih 3 copies lagi.
- Kertas biasa: PDF tiga set berlabel Arsip Gudang, Outlet dan Accounting. Jangan mengalikan copies lagi.

Template hitam-putih, tabel berulang pada halaman lanjutan, total invoice, catatan yang mengalir antarhalaman, kotak tanda tangan tidak terbelah dan nomor halaman per set. PDF tidak mem-posting transaksi ulang. Hasil cetak fisik belum diverifikasi karena tipe printer/ukuran kertas belum diberikan. Setelan hanya disimpan pada browser, bukan mengubah data barang.

## Integritas dan akses

Owner/Admin Pusat/Admin Gudang aktif dapat mengubah; Finance aktif membaca laporan dan opname. Snapshot HPP kiriman disimpan di tabel privat, tidak ikut payload penerimaan outlet. Database memeriksa peran dari penugasan aktual dan status pengguna, bukan metadata klien. Tabel baru memiliki RLS, akses tulis hanya melalui RPC; fungsi privileged ada pada schema privat gudang_internal dengan endpoint publik invoker. Harga memakai pemeriksaan harga lama; draft opname memakai versi dan snapshot jumlah/waktu stok. Finalisasi serta pengiriman/mutasi gudang memakai lock bersama, seluruh posting opname satu transaksi dan retry finalisasi tidak menambah mutasi lagi. Pengiriman menolak total kebutuhan barang yang melebihi stok, termasuk bahan yang muncul dalam beberapa baris.

Fitur tetap menggunakan mesin mutasi/penerimaan yang sudah ada. Tidak mengubah kas POS, absensi, payroll, data proyek atau catatan outlet; tidak menghapus data lama. Draft POS/PIN lokal dari pekerjaan sebelumnya disimpan sebagai backup terpisah; pembaruan POS/PIN yang sudah masuk melalui branch produksi tetap dipertahankan dan tidak ditimpa draft lama.

## Verifikasi

Tes PostgreSQL lokal menguji edit/stale harga, otorisasi, snapshot HPP, penerimaan parsial dan periode, stok opname kosong/selisih/konflik/retry, biaya dan pembatalan. Tes laporan memeriksa HPP belum lengkap dan selisih bertanda positif/negatif. Tes PDF membandingkan satu set NCR dengan tiga set kertas biasa, empat kotak tanda tangan, ukuran kertas, laporan opname dan laba rugi. Lima contoh PDF dirender dengan Poppler dan diperiksa batas teks serta tata letaknya. Fixture Supabase `supabase/tests/gudang_revisi.sql` menggunakan role authenticated dan penerimaan barang asli dalam transaksi yang seluruhnya ROLLBACK.

Hasil: 256 tes dalam 39 file lolos; lint, TypeScript dan build produksi lolos (warning lama halaman simulasi). Fixture authenticated Supabase lolos dan seluruh data uji di-ROLLBACK. Advisor keamanan tidak menambah temuan; indeks FK baru belum digunakan sebelum fitur dipakai. Browser UI tidak tersedia pada sesi ini, sehingga verifikasi visual dilakukan pada hasil PDF; cetak fisik tetap perlu disesuaikan printer.
