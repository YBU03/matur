# Penjualan Kominot 1 November dan PDF Finance

## Data asli

Atas persetujuan pemilik, 15 transaksi Kominot tanggal 1 November 2026 (Rp636.000) diganti dengan 38 transaksi dari `Penjualan ruma 1-11-2026.pdf` (SHA256 `547ae105739ba76ec6a8e3ca075c230d95c4615f5faa454e6fa42fcf603d365f`). Total 82 item, Rp1.758.000, seluruhnya lunas. Tunai Rp786.000 (16), QRIS Rp720.000 (17), Grab-Food Rp155.000 (3), Shopee-Pay Rp97.000 (2). Nomor sumber 009846–009883 dan nomor referensi asli tetap disimpan, termasuk ref25 yang waktunya setelah ref30.

Operasi final 2 November 2026, batch privat `4337090a-8b33-40fa-81d5-a07c3d921db4`. Enam snapshot dengan checksum valid: transaksi, item, pembayaran, mutasi pemakaian lama, stok outlet sebelum penggantian, dan sesi kas terkait. Tidak menyimpan isi backup akun/kredensial di repo. Checksum transaksi luar lingkup (termasuk 9 transaksi Demo Rp241.000), stok gudang/outlet lain, mutasi lain, master outlet/menu dan biaya harus identik sebelum-sesudah. Script operasi default ROLLBACK dan guard 15/Rp636.000 menolak pengulangan setelah berhasil.

PDF merupakan rincian per BILL: produk gabungan dan total qty, bukan jumlah/harga per produk. Snapshot JSON `transaksi.sumber_penjualan` menyimpan fakta dokumen, tanpa membuat menu/item/HPP palsu. Stok pemakaian dari 15 transaksi lama dibalik tepat sesuai 76 mutasi; dokumen pengganti tidak menjalankan resep lagi. Stok historis, HPP, laba, penjualan per produk, dan kewajiban titipan belum lengkap tanpa rincian barang sumber. Peringatan ditampilkan di laporan/dashboard. Tipe pesanan/kasir tidak tersedia; kolom wajib tipe memakai nilai kompatibilitas internal dan tidak dipresentasikan sebagai fakta dokumen. Tidak mengasumsikan Shopee-Pay sebagai ShopeeFood. Dua nilai metode bayar historis ditambahkan agar pembayaran tidak salah dikategorikan sebagai transfer.

Kas terkait juga berisi satu transaksi 2 November Rp23.000, sehingga sesi tersebut tidak dihapus. Uang aktual Rp392.000 dan setoran lama Rp192.000 tetap dipertahankan. Ekspektasi dihitung ulang menjadi Rp861.000 dan selisih menjadi minus Rp469.000; catatan penutupan menjelaskan koreksi sumber. Angka aktual ini perlu dicocokkan Finance, bukan otomatis dianggap sama dengan omzet baru. Tidak membuka kas final, tidak mengubah pengeluaran atau transaksi tanggal lain.

## Tampilan dan ekspor

- Riwayat POS menggunakan tabel transaksi/pembayaran yang sama: 1 November tampil 38 transaksi/Rp1.758.000. Kemarin mengikuti WIB saat dibuka.
- Cari nomor sumber/ref/nama produk dan buka rincian gabungan. Transaksi asli POS tetap memakai struk normal; dokumen historis membuka rincian sumber tanpa harga satuan hasil perkiraan.
- Finance → Laporan POS → Penjualan: pilih outlet, Hari ini/Kemarin/7 hari/Minggu ini/Bulan ini/Bulan lalu/30 hari atau Dari–Sampai.
- Preview / Unduh PDF: preview tabel di aplikasi agar tetap berfungsi tanpa pembaca PDF browser. Berkas A3 landscape, 18 kolom seperti dokumen sumber, warna/kop Matoer, header setiap halaman, nomor halaman, total hanya transaksi lunas. Export mengikuti pencarian dan urutan tampilan. Excel dan cetak halaman lama tetap tersedia.
- Waktu transaksi WIB; tanggal pembayaran sumber tetap tanggal saja. Rincian normal diambil dari item dan pembayaran aktual. Tidak ada webhook bank atau perubahan QRIS/printer pada pekerjaan ini.

## File dan verifikasi

Perubahan utama: `src/lib/laporan-penjualan-pdf.ts`, konfigurasi laporan, halaman/view Laporan POS, riwayat kasir, indikator kelengkapan dashboard/pantau POS, dan opsi modal lebar (default komponen lain tetap). Migrasi `20261102082402_penjualan_sumber_pdf_laporan.sql` dan `20261102082804_penjualan_sumber_tanggal_dan_kpi.sql` diterapkan; kewenangan RPC/RLS yang sudah ada dipertahankan.

348 tes pada 55 file lolos, termasuk uji PDF multipage, tanggal WIB, sumber/native, total tanpa void dan preset lintas bulan. SQL authenticated Owner/Finance menguji 38 transaksi/82 item/Rp1.758.000, pembayaran, ringkasan/dashboard; anon ditolak. Operasi terlebih dahulu diuji ROLLBACK sebelum COMMIT, lalu jumlah/metode/snapshot diverifikasi lagi. Security advisor tidak menemukan masalah baru terkait perubahan ini.

Browser lokal memakai data dokumen sumber: preview/unduh PDF berhasil, PDF hasil unduh dibuka kembali dan dirender untuk pemeriksaan header/tabel/total, pengujian 390px tanpa overflow halaman, pencarian nomor sumber dan popup rincian POS berhasil. Halaman QA dan pengecualian middleware sudah dihapus. TypeScript/lint/build akhir diperiksa sebelum deploy.
