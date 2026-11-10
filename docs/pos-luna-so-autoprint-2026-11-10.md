# POS: riwayat, Extra Shot, SO akhir shift, dan cetak otomatis

## Perilaku
- Antrean memiliki tab Pesanan Aktif dan Riwayat Order. URL riwayat lama dialihkan dengan filter tetap tersimpan. Tablet menampilkan daftar dan rincian berdampingan; ponsel membuka rincian pilihan.
- Rekap produk periode terpilih dikelompokkan Coffee, Non-Coffee, lalu kategori lain. Jumlah dan omzet kotor dihitung dari item transaksi, sebelum diskon transaksi; impor ringkasan tanpa item tidak dibuatkan rincian fiktif.
- Extra Shot/Shoot bisa dipilih berulang hingga 10. Harga, nama struk, bahan resep, HPP, laporan modifier, draft, dan void memperhitungkan jumlah extra. Modifier lain tetap satu pilihan.
- Setiap transaksi baru yang berhasil, termasuk tunai, QRIS biasa/dinamis, debit, transfer, platform online dan split, mencoba cetak otomatis sekali. Membuka riwayat tidak mencetak otomatis. Kegagalan atau hasil yang tidak pasti meminta cetak manual; tidak mengulang otomatis.
- Android/Bluetooth menggunakan printer yang sudah dipilih. Browser biasa membuka dialog cetak; aplikasi tidak bisa memastikan kertas benar-benar keluar. Printer fisik tetap perlu dicoba di perangkat outlet.
- SO tersedia langsung di tutup kas/serah terima, menampilkan semua bahan per kategori, kemasan/sisa, navigasi Enter, kemajuan dan filter belum diisi. Kosong berarti belum dihitung; nol berarti habis. Draft lokal dipisahkan per pengguna/outlet/kas. Selisih diperiksa sebelum simpan, dengan konfirmasi dan RPC opname lama. SO tidak mengunci POS atau menjadi syarat wajib menutup kas.
- Riwayat SO menampilkan petugas dan perbandingan stok untuk pengecekan shift berikutnya. Snapshot draft lama tetap diperiksa server; muat ulang stok sistem tersedia ketika perlu menghitung ulang.

## Database
Migrasi 20261110035014 mempertahankan core checkout, idempotensi, otorisasi, dan perlindungan stok yang sudah ada. Hanya Extra Shot yang boleh memiliki ID modifier berulang. RPC rekap_produk_pos memakai SECURITY INVOKER dan RLS tabel yang sudah ada, membutuhkan pengguna login, dengan batas periode 94 hari. Tidak mengubah data transaksi atau pengaturan QRIS statis outlet operasional.

## Validasi
Browser dengan data lokal: seluruh metode auto print sekali, tanpa auto print dari riwayat, gagal/manual retry, Extra Shot berulang, rincian kategori, SO inline/draft/reload/Enter/nol/review/simpan, tampilan ponsel tanpa overflow. Bridge printer disimulasikan, bukan uji printer fisik.

Database produksi diuji dengan fixture sementara di dalam transaksi yang di-ROLLBACK: dua gelas dengan tiga Extra Shot menghasilkan harga/HPP/pemakaian bahan yang tepat, retry tidak menggandakan, void mengembalikan stok. Tidak ada transaksi uji yang disimpan. Pemeriksaan advisor keamanan sebelum/sesudah tidak menambah temuan.
