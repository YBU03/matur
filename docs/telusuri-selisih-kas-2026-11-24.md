# Penelusuran selisih kas dan modal nol — 24 November 2026

Catatan Harian: tombol Telusuri selisih per shift; ringkasan harian membuka daftar shift sumber yang setoran akhirnya diatribusikan pada tanggal tersebut. Setiap tombol membuka pemeriksaan shift dengan ID eksplisit, bukan memilih shift terbaru secara diam-diam.

Diagnosis menampilkan tanggal awal, waktu buka/tutup WIB, tanggal pencatatan, rumus kas seluruh shift dan tautan koreksi penjualan untuk rentang aktivitas shift. Penjualan tunai sehari dibedakan dari tunai seluruh shift yang melintasi tanggal. Pengeluaran pusat tidak mengurangi laci.

Revisi uang aktual tersedia dalam panel diagnosis tanpa modal bertumpuk. Input Rp0 valid, alasan wajib, nilai sebelumnya diperiksa oleh RPC untuk mencegah penimpaan revisi lain. Pratinjau setoran dan selisih memakai nilai seharusnya tersimpan yang dipakai RPC; tidak menjanjikan selisih selalu nol. Sesudah tersimpan, pemeriksaan dimuat ulang dan halaman disegarkan. Riwayat revisi aktual tetap tersedia.

Mulai shift menyediakan pilihan eksplisit Tanpa modal · Rp0, selain nominal umum dan input manual. POS langsung tetap tanpa gerbang baru; formulir modal opsional juga menyediakan tombol Rp0. Pemilihan tidak otomatis menyimpan; tetap melewati konfirmasi mulai shift/Simpan modal. Nilai menggunakan modal_laci yang sama dengan Akunting; tidak membuat modal kedua atau mengubah shift lama.

## Koreksi data UHB sesuai konfirmasi pemilik

Hanya shift 2204d9c1-1906-482a-b0af-14d101a316a6 (22 November, ditutup 23 November) diperbaiki: modal awal 200.000 → 0; fisik akhir 46.000 → 0. Riwayat log_aktivitas dan revisi_aktual_kas menyimpan alasan.

Setelah penelusuran, transaksi #12 2f10a538-d646-466c-a565-4ba9b6cef8cd Rp154.000 dikonfirmasi sebagai produk gratis untuk influencer fadilades, tanpa pembayaran ke outlet. Transaksi dipindahkan ke tempat sampah melalui RPC dengan alasan; rincian menu, varian, harga dan HPP historis Rp63.770 disalin ke produk_keluar jenis endorse, nilai jual Rp154.000. Jumlah pemakaian bahan asli dipindahkan ke mutasi marketing melalui geser_stok; assertion memastikan total mutasi setiap bahan outlet tidak berubah.

Biaya 2173a7a3-a42b-4f94-932d-b4f52f131c09 Rp154.000 dikonfirmasi bukan pengeluaran uang tambahan, sehingga diarsipkan untuk mencegah biaya produk dicatat dua kali. Tidak ada refund, transfer, atau pembayaran pusat fiktif. Audit menghubungkan transaksi, biaya lama dan ID produk marketing baru. Seluruh koreksi diuji dalam transaksi ROLLBACK sebelum COMMIT dengan pemeriksaan keadaan awal.

Hasil akhir shift: modal 0, fisik 0, setoran 0, seharusnya 0, selisih 0. Tidak mengubah shift UHB lain atau data Kominot. Tidak ada perubahan skema/RLS/RPC pada pekerjaan ini.
