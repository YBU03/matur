# Hapus/arsipkan promo — 27 November 2026

Di `/promo`, pengelola menekan **Hapus/Arsipkan**, membaca konfirmasi, lalu menyetujui. Promo dipindahkan ke tab **Arsip**, dinonaktifkan, dan reservasi belum dibayar dilepas. Riwayat penjualan, snapshot diskon, kuota terpakai dan laporan/subsidi tidak dihapus atau diubah. Data simulasi Outlet Demo tidak diarsipkan otomatis; pemilik memilih promo yang dimaksud di panel.

Tab Semua/Berjalan/Terjadwal/Nonaktif/Selesai tidak menghitung arsip. Pencarian nama juga tersedia di tab Arsip. Kartu arsip menampilkan waktu WIB dan nama pengarsip. **Pulihkan** memerlukan konfirmasi dan selalu menghasilkan promo nonaktif, bukan mengaktifkan kembali otomatis. Aturan dapat diperiksa/diedit lalu diaktifkan dengan konfirmasi yang sudah ada. Edit/aktifkan tidak tersedia pada arsip dan ditolak server walaupun dipanggil dari layar lama.

## Penyimpanan dan kewenangan

Migrasi `20261127023715_promo_archive.sql` menambah metadata arsip dan CHECK arsip selalu nonaktif. RPC public `arsip_promo(i,v,pulihkan)` bersifat invoker; implementasi privat ber-search_path kosong, autentikasi/kewenangan yang sama dengan edit promo (pusat termasuk Marketing global, SPV hanya promo satu outlet yang dikelola), serta versi terbaru. Finance/kasir/anon tidak dapat mutasi. Tidak ada DELETE fisik. Arsip/pulihkan menambah log_aktivitas beserta aktor, nilai sebelum/sesudah. Pulihkan tidak menghidupkan quote yang sudah dilepas.

Arsip, pesan promo, dan checkout menggunakan lock pada baris promo yang sama. Transaksi yang lebih dahulu selesai tetap sah; jika arsip lebih dahulu, quote ditolak. Pesan penolakan memakai jalur penyegaran reservasi POS yang sudah ada, dengan pemeriksaan perubahan total sebelum kasir melanjutkan. Penjualan harga normal tetap bisa dilakukan. Laporan historis tidak memfilter transaksi hanya karena promonya diarsipkan.

## Verifikasi

SQL PGlite: arsip+pulihkan, audit, snapshot transaksi dan laporan identik, quote menunggu dilepas/ditolak, transaksi normal tetap berjalan, kuota/promo lama, aktivasi terpisah, versi kedaluwarsa dan pembatasan SPV/finance/kasir/anon. DOM: konfirmasi/batal, tab/pencarian dan hitungan, pemulihan nonaktif, galat server, finance baca saja. Browser panel asli: modal konfirmasi dan pemulihan, tab Arsip, aktor, layout 1024×768 dan390×844; POST diblok, tidak mengubah promo sungguhan. Route QA dan pengecualian middleware dihapus.

RPC produksi diuji melalui role authenticated di transaksi ROLLBACK menggunakan salinan sementara; hasil arsip/pulihkan/audit terverifikasi. Advisor keamanan sebelum/sesudah tetap 261 temuan existing, tidak ada temuan baru dari perubahan ini.
