# POS adaptif — 27 November 2026

Tablet/laptop memakai menu di kiri dan pesanan/pembayaran di kanan sesuai ruang browser yang tersedia. Lebar area POS minimal 720px dan tinggi layar minimal 440px (atau lebar area 960px) memakai dua kolom. HP termasuk landscape pendek tetap memakai Lihat & Bayar.

Tinggi area dihitung dari posisi POS sesudah header/status, mengikuti resize dan visual viewport. Menu dan rincian pesanan memiliki scroll sendiri; total, metode pembayaran dan tombol Draft/Bayar tetap terlihat. Pengaturan kanal/pelanggan dan promo dapat dibuka di panel kanan. Nama menu dan harga disusun agar tetap terbaca pada panel sempit. Split dapat dibuka dari footer dan langsung menampilkan rinciannya.

Hook hanya mengukur DOM, tanpa request/polling baru. State keranjang, promo, metode, draft dan modal tetap berada pada komponen yang sama saat resize. Tidak mengubah checkout, harga, stok, shift, autentikasi atau database. Tidak menambahkan reload otomatis; kasir memuat ulang setelah transaksi selesai dan keranjang kosong untuk memperoleh tampilan baru.

## Verifikasi

Playwright dengan PosScreen asli melalui route QA sementara, server actions diblok agar tidak membuat transaksi nyata. Viewport 800×600, 960×600, 1024×600, 1280×800, 768×1024, 390×844 dan 844×390. Lima belas menu @Rp23.000 menghasilkan Rp345.000; isi/total dan pilihan Debit bertahan saat resize berulang. Footer tetap dalam viewport ketika rincian panjang digulir; tidak ada overflow horizontal; tinggi kartu menu tidak tertekan; HP membuka/menutup keranjang dan melepas body lock; split serta modal tunai dapat dibuka. Screenshot diperiksa. Route QA dan pengecualian middleware dihapus sebelum build. Ini simulasi viewport browser, bukan pengujian langsung perangkat UHB.
