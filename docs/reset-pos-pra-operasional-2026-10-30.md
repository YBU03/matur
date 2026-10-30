# Reset POS pra-operasional — 30 Oktober 2026

Pemilik meminta seluruh transaksi POS yang telah diperiksa dikosongkan untuk operasional mulai 1 November. Pemilik kemudian menegaskan bahwa pengeluaran berlabel asli juga seluruhnya latihan dan ikut dikosongkan.

Eksekusi final: 30 Oktober 2026 15:20 WIB. Batch privat: `c2d3fd76-a448-425b-986c-7f187677e3a0`.

## Hasil

- Transaksi 3.415 → 0 (asli dan simulasi); pembayaran 3.416 → 0; rincian barang 6.659 → 0.
- Kas 117 → 0; draft 12 → 0; pengeluaran termasuk arsip soft-delete 31 → 0; input/koreksi penjualan 9 → 0; produk marketing simulasi 2 → 0.
- Metadata yang merujuk kas latihan, izin kas lama, serah terima dan riwayat pengaturan kas latihan diarsipkan lalu dibersihkan. Akun, sandi outlet, PIN, aturan shift, perangkat terdaftar dan rahasia perangkat tetap utuh. Nomor transaksi berikutnya menggunakan max nomor per tanggal; dari kosong dimulai 1.
- Pemakaian stok asli berdasarkan ref transaksi dibalik tepat sesuai mutasi. Semua saldo bahan outlet Kominot dan Demo kembali 0; stok/mutasi simulasi outlet dihapus. Stok gudang dan mutasi kiriman asli tetap utuh.
- Master 3 outlet, 36 menu, 32 bahan, 52 pengguna, penugasan, absensi/jadwal/gaji, 3 kiriman dan 4 laporan bulanan lama tetap utuh. Proyek tidak disentuh.

## Cadangan dan keamanan

23 snapshot disimpan di `arsip_operasional_internal`, bukan schema Data API. Setiap snapshot menyimpan tabel asal, jumlah, seluruh baris dan checksum MD5 untuk pemeriksaan integritas. RLS aktif tanpa kebijakan akses; anon/authenticated/service_role tidak memiliki USAGE schema. Hanya operator database berwenang yang dapat memulihkan. Tidak menyimpan isi cadangan/kredensial di repository atau output laporan.

Script `supabase/operations/reset_pos_pra_operasional_20261030.sql` adalah operasi SATU KALI, bukan migration yang dieksekusi otomatis. Versi repository berakhir ROLLBACK. Ada guard jumlah transaksi/pengeluaran dan antrean offline; setelah reset guard menolak eksekusi ulang. Script sudah diuji rollback sebelum eksekusi COMMIT final. Tidak menonaktifkan trigger global; penanda kas tim tertutup latihan dinetralkan hanya dalam transaksi terkunci, sebelum baris kas itu dihapus.

Pemeriksaan checksum master/warehouse sebelum-sesudah wajib cocok atau seluruh transaksi dibatalkan. Antrean server dan antrean terakhir yang dilaporkan perangkat = 0. Tidak mengakses/menghapus IndexedDB perangkat fisik; tutup dan buka ulang POS sebelum memulai kas baru.

Verifikasi setelah COMMIT: seluruh tabel penjualan/kas/pengeluaran/draft/koreksi/marketing/pending kosong, saldo outlet nol, 23 snapshot valid checksum, akun/master/kiriman/laporan lama tetap ada. Tidak ada perubahan kode aplikasi atau aturan login/shift.
