# Promo & Diskon POS — 18 November 2026

Pengaturan tersedia di `/promo`, menu **Promo & Diskon**. Owner, Admin Pusat, Admin Gudang dan HRD mengelola promo. SPV hanya mengelola promo untuk satu outlet penugasannya; tidak dapat mengubah promo global atau lintas outlet. Finance melihat pemakaian promo melalui menu **Pemakaian Promo**. Kasir hanya memakai promo aktif.

## Pengaturan

- Nama, aktif/nonaktif, tanggal kalender WIB dan rentang jam dalam hari yang sama.
- Pilih satu/beberapa outlet, atau semua outlet (otomatis mencakup outlet baru). Tidak ada promo/outlet yang diaktifkan otomatis saat pemasangan fitur.
- Satu aturan per menu/kemasan: diskon persen, potongan rupiah per item, atau harga akhir per item **termasuk tambahan varian**. Varian opsional yang dipilih menjadi syarat wajib; kosong berarti semua varian menu tersebut.
- Satu promo per transaksi. Pengelola dapat mengizinkan tambahan diskon manual; persetujuan SPV untuk diskon manual tetap berlaku terhadap nilai setelah potongan promo.
- Kuota opsional per hari operasional (berganti pukul 03.00 WIB), gabungan semua menu atau terpisah per menu; dihitung per outlet atau bersama lintas outlet. Kuota menghitung jumlah item yang benar-benar mendapat potongan.
- Perubahan memakai versi agar edit pengguna lain tidak tertimpa dan tercatat dalam Log Aktivitas. Reservasi yang sudah terbit tetap dihormati sampai batas waktunya, termasuk setelah promo dinonaktifkan/diedit.

## Kasir dan pembayaran

1. Isi keranjang, lalu **Muat / segarkan promo** di panel keranjang.
2. Pilih promo dan **Terapkan promo**. Server memeriksa akun/perangkat, outlet, sesi, katalog, varian, waktu, harga dan kuota. Jika katalog layar berbeda dengan harga server, kasir diminta memuat ulang.
3. Server menahan kuota maksimal 15 menit, dibatasi jam akhir promo dan pergantian hari operasional. Panel menampilkan nama, potongan, sisa kuota saat reservasi, serta waktu berakhir. Kuota diamankan sebelum QR pembayaran ditampilkan.
4. Bayar menggunakan total setelah promo. Promo yang sudah disetujui pengelola tidak meminta PIN diskon besar lagi. Transaksi manual besar tetap mengikuti izin SPV.
5. Mengubah keranjang/kanal/diskon/sesi melepas reservasi dan memerlukan penerapan ulang. Draft tidak menyimpan reservasi; terapkan lagi saat membayar draft.

Promo memerlukan internet dan tidak masuk antrean tunai offline. Tunai biasa tanpa promo tetap memakai antrean offline yang sudah ada. Setelah respons jaringan hilang, pengiriman ulang menggunakan ID transaksi/reservasi yang sama. Jika pembayaran sudah dilakukan, periksa riwayat sebelum membuat transaksi baru. Saat reservasi berakhir, QR ditutup dan kasir diminta memeriksa pembayaran/riwayat sebelum melanjutkan.

## Pencatatan

Harga katalog dan aturan/nama promo disalin ke reservasi dan transaksi sehingga perubahan berikutnya tidak mengubah riwayat. `transaksi.diskon` berisi **diskon promo + manual**, sehingga laporan Accounting yang sudah ada tetap menghitungnya sekali. Nama promo tampil pada struk pertama, unduhan, berbagi teks dan cetak ulang dari riwayat.

Laporan pemakaian `/promo` memiliki filter outlet dan rentang tanggal maksimal 366 hari. Menampilkan transaksi, promo, jumlah item, potongan, total bayar dan status. Ringkasan hanya memasukkan transaksi lunas. Void/hapus mengembalikan kuota satu kali. Pemulihan transaksi memeriksa ulang kuota pada hari operasional asal; jika sudah penuh, pemulihan ditolak sampai kuota tersedia/disesuaikan pengelola.

## Implementasi dan verifikasi

Tabel privat `promo_internal.promo` dan `promo_internal.pesanan`, RLS tanpa izin akses tabel langsung. RPC publik invoker memanggil fungsi privat dengan pemeriksaan akun aktif/peran/outlet. Pengambilan kuota dikunci pada baris promo dan pencatatan pembayaran/kuota terjadi dalam transaksi database yang sama. Kegagalan pembayaran membatalkan pemakaian kuota; reservasi tetap bisa dicoba ulang hingga berakhir.

Migrasi menambahkan `transaksi.promo_snapshot` dan menyisipkan validasi promo pada mesin harga yang sudah ada dengan pemeriksaan pola fungsi. Tidak mengganti mesin stok atau mengaktifkan pengunci login/shift lama. Tidak menambah polling jaringan POS.

Pengujian khusus `promo-sql.test.ts`: hak akses/anonim, versi edit, tiga jenis harga, syarat varian, kuota gabungan/per menu/per outlet/lintas outlet, retry, katalog beku, pembayaran gagal, diskon manual/SPV, offline, kedaluwarsa, void/pemulihan, laporan Finance dan transaksi biasa. `supabase/tests/promo_diskon_pos.sql` menguji jalur tablet authenticated pada database sebenarnya dan selalu ROLLBACK.

Uji browser visual belum dijalankan karena akses browser pada sesi ini dibatasi kebijakan browser. Bukti verifikasi tersedia dari tes otomatis, build aplikasi, uji database terisolasi dan status deployment GitHub/Vercel.

Hasil verifikasi: 94 berkas tes / 540 tes lulus; TypeScript dan ESLint bersih. Uji database tablet authenticated lulus dan ROLLBACK. Security advisor tidak menambah WARN/ERROR; dua INFO RLS tanpa policy adalah tabel privat yang sengaja tidak dibuka untuk akses langsung. Migrasi tersimpan sebagai `20261118033002_promo_diskon_pos.sql`, sesuai versi riwayat database.

## Tampilan baru halaman /promo (18 November 2026)

Hanya tampilan; RPC `simpan_promo`/`daftar_promo`/`laporan_promo`, aturan, kuota dan kasir tidak berubah.
- Header berwarna + 4 kartu angka (promo berjalan, terjadwal, transaksi promo lunas, total potongan/subsidi periode).
- Tab Semua/Berjalan/Terjadwal/Nonaktif/Selesai + cari nama. Status dihitung di `src/lib/promo-tampilan.ts` (tanggal/jam WIB, lencana "Di luar jam" bila berjalan tapi di luar rentang jam).
- Kartu promo: label nilai besar (Diskon %, Potong Rp, Harga Rp, Voucher, Gratis), periode mudah dibaca, label outlet/menu, kuota, garis warna status.
- Tombol cepat Aktifkan/Nonaktifkan (konfirmasi `tanya`, memakai `simpanPromo` dengan versi yang sama → tercatat di Log Aktivitas) dan Duplikat (membuka form promo baru nonaktif berisi salinan).
- Form dibagi 5 bagian bernomor + pratinjau ringkas; isian sama seperti sebelumnya.
- Laporan pemakaian: ringkasan + tabel seragam (`ui-halaman`), kartu per transaksi di HP; total bayar Rp0 tampil "Rp0".
