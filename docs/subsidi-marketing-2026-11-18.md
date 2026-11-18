# Subsidi promo dan biaya marketing — 18 November 2026

## Pengelolaan promo

Menu **Promo & Diskon** `/promo` tetap memakai kewenangan sebelumnya: Pusat, Gudang, HRD dan SPV sesuai outlet. Pemilihan menu diganti pencarian ketik nama/kemasan; hasil menampilkan kemasan, menu yang sudah dipilih ditandai, dan hasil panjang dapat dipersempit dengan mengetik.

Tambahan jenis **Gratis — ditanggung subsidi**. Pilihan ini otomatis mengaktifkan subsidi penuh per item termasuk tambahan varian. Subsidi sebagian menggunakan potongan rupiah, persen atau harga akhir dengan opsi **Potongan ditanggung kantor sebagai subsidi**. Nama penanggung/subsidi bisa diganti, misalnya Subsidi Kantor, Opening atau Marketing. Gratis wajib memakai subsidi di server; tidak bisa disimpan sebagai diskon biasa gratis tanpa penanggung.

Contoh menu Rp20.000:

- Gratis/subsidi penuh: pelanggan Rp0, tagihan subsidi Rp20.000.
- Subsidi potongan Rp5.000: pelanggan Rp15.000, tagihan subsidi Rp5.000.
- Diskon biasa Rp5.000: pelanggan Rp15.000, tanpa tagihan kantor.

Harga, nama subsidi dan nominal saat transaksi dibekukan. Transaksi total Rp0 hanya diterima untuk reservasi subsidi sah. Tidak membuat pembayaran pelanggan palsu, tidak meminta QR/uang tunai. Stok dan HPP tetap diproses mesin transaksi yang sama; kuota, retry, syarat outlet/menu/varian/waktu serta persetujuan diskon manual tetap berlaku. Subsidi tetap online saja.

Struk, PDF/print dan berbagi teks menampilkan nama serta potongan subsidi secara terpisah; struk gratis menjelaskan pelanggan ditanggung subsidi. Koreksi Accounting berikutnya tidak mengganti struk atau pembayaran pelanggan yang sudah selesai.

## Accounting

Owner, Admin Pusat dan Finance mendapat menu **Diskon & Subsidi Marketing** `/subsidi-promo`.

**Rekap marketing** mencakup seluruh diskon POS termasuk diskon manual, bukan hanya promo baru. Filter tanggal operasional/outlet; rincian transaksi, operator, menu/kemasan, jumlah/harga, nama promo, diskon biasa, subsidi, pembayaran pelanggan, catatan dan status. Total hanya transaksi lunas. Diskon biasa termasuk diskon manual, sementara subsidi ditampilkan terpisah; keduanya dijumlahkan sekali sebagai total potongan marketing.

**Tagihan subsidi** dibuat satu kali saat checkout berhasil. Menampilkan nilai awal, nama/nominal terkini, pembayaran bersih, sisa, serta lebih bayar. Filter belum/sebagian dibayar, lunas, void/hapus, dan perlu pengembalian.

- **Edit**: nama, nominal dan catatan bisa dikoreksi, wajib alasan. Versi data mencegah perubahan pengguna lain tertimpa. Nominal tidak boleh turun di bawah pembayaran bersih; koreksi/catat pengembalian lebih dahulu.
- **Pembayaran**: tanggal, nominal, catatan dan bukti JPG/PNG/PDF maksimal 5 MB wajib. Bisa bertahap. Server menolak pembayaran melebihi sisa dan pengembalian melebihi pembayaran bersih.
- **Koreksi catatan pembayaran**: batalkan dengan alasan, lalu catat ulang. Catatan dan bukti lama tidak dihapus. Permintaan pembayaran memakai ID stabil agar retry tidak menggandakan pembayaran.
- **Riwayat**: rincian menampilkan perubahan nama/nominal, pengguna, alasan, tanggal, pembayaran/pengembalian dan bukti. Bukti privat dibuka dengan tautan singkat bagi Accounting/Pusat saja.

Periode daftar tagihan mengikuti tanggal transaksi, dengan status pembayaran **terkini**. Tanggal setiap pembayaran/pengembalian terlihat di rinciannya.

## Rekonsiliasi, void dan batas pencatatan

`subtotal − diskon biasa − subsidi = pembayaran pelanggan`. Semua potongan masih termasuk `transaksi.diskon` dan sudah mengurangi penjualan bersih POS. Rekap biaya marketing **tidak menambahkan biaya kedua ke biaya_outlet**; laba tidak dikurangi dua kali.

Tagihan kantor dan pelunasannya adalah administrasi subsidi terpisah. Pelunasan tidak membuat penjualan POS, setoran laci atau pendapatan baru. Tidak menyatakan perpindahan uang bank otomatis. Nilai awal marketing mengikuti transaksi asli; nilai tagihan yang dikoreksi tersedia terpisah agar perbedaannya dapat direkonsiliasi.

Void/hapus mengembalikan kuota lewat alur promo lama. Target tagihan menjadi nol berdasarkan status transaksi, tetapi uang kantor yang sudah diterima dan bukti tetap tersimpan: tampil sebagai lebih bayar/perlu pengembalian. Accounting bisa mencatat pengembalian dengan bukti. Pemulihan transaksi mengaktifkan lagi target tagihan yang sama dan tetap memeriksa kuota; tidak membuat tagihan kedua.

## Verifikasi

Migrasi `20261118040314_promo_subsidi_kantor.sql`, dua tabel privat RLS dengan akses RPC terjaga, bucket privat `subsidi-bukti`. Tidak ada promo yang diaktifkan/diisi otomatis.

94 berkas / 545 tes lulus; TypeScript, ESLint quiet dan build produksi lulus. Uji tambahan mencakup gratis, subsidi sebagian, stok/HPP, tanpa pembayaran pelanggan palsu, versi/alasan koreksi, hak akses, bukti, pelunasan/retry, pembatalan pembayaran, void/pengembalian dan rekap marketing. Uji database authenticated tablet + Accounting pada `supabase/tests/promo_subsidi_kantor.sql` lulus dan seluruh fixture ROLLBACK. Advisor tidak menambah WARN/ERROR; dua INFO RLS tanpa policy adalah tabel privat yang memang tidak dibuka untuk akses langsung.

Uji tampilan browser langsung belum tersedia karena kebijakan akses browser sesi ini; bukti verifikasi berasal dari tes, build, integrasi database dan deployment commit.
