# Coffee Series dan pemilihan menu promo — 26 November 2026

Kategori produk terpisah dari penyajian (`menu.penyajian`: ice/hot/tanpa/NULL belum ditentukan) dan kemasan fisik (`menu.jenis_kemasan`: Cup/Can/Botol/teks lain). Kolom lama `kemasan` dan `induk_id` tetap graph menu anak berharga sendiri; tidak diganti, digabung, atau dibuat ulang.

## Data produksi

`scripts/sql/coffee-series-2026-11-26.sql` memetakan 30 menu shared RUMA yang sudah diperiksa. Coffee Series: 10 Ice Cup, 5 Hot Cup, 3 Can. Suhu Can belum ditentukan; tidak diasumsikan Ice. Non-Coffee: 9 Ice Cup, 2 Hot Cup (Chocolate dan Matcha), 1 Botol Mineral Water tanpa asumsi suhu. Makanan/merchandise tidak diubah. Pemilihan berdasarkan nama exact, kategori asal dan katalog bersama; transaksi abort jika ada nama yang tidak cocok atau ganda. Owner authenticated, RLS dan trigger audit existing. Coffee Series urutan pertama; kategori lama tidak dihapus.

ID, nama, harga, kemasan lama, aktif, resep, HPP, transaksi, stok dan promo tidak disentuh. Skrip memverifikasi seluruh kolom menu selain kategori dan dua metadata baru identik sebelum commit. Bisa dijalankan ulang tanpa update bila sudah sesuai. Tidak boleh dijalankan ulang untuk menimpa klasifikasi baru tanpa pemeriksaan.

## Tampilan

- Master → Menu: kategori, penyajian dan jenis kemasan dapat diedit sesuai hak master existing.
- POS: klik Coffee Series menampilkan menu induk berkategori tersebut. Kategori tanpa menu tersedia tidak ditampilkan. Kasir yang sudah membuka halaman perlu memuat ulang katalog; tidak ada tambahan polling atau perubahan sesi/harga.
- Promo: filter kategori, penyajian, kemasan dan pencarian; pratinjau seluruh hasil dengan harga jual; tombol menambahkan hanya ID yang belum dipilih. Pilihan lama tidak dihapus oleh filter. Harga/diskon diatur pada baris promo existing. Simpan/konfirmasi aktif dan audit existing tetap berlaku.
- Filter hanya alat memilih menu, bukan aturan dinamis. Daftar ID menu yang sudah disimpan pada promo tidak berubah ketika kategori/menu master berubah atau menu baru ditambahkan. Tidak membuat maupun mengaktifkan campaign PBG otomatis.
- Marketing menerima dua metadata baru lewat RPC katalog privat dengan proyeksi harga jual; tidak membuka tabel master mentah, HPP atau biaya. Hak Marketing/HRD/SPV tidak diperluas.
- Anak kemasan baru mewarisi metadata penyajian, Hot/Ice menentukan suhu dan Cup, label kemasan lain menjadi jenis kemasan. Salinan katalog outlet baru mempertahankan metadata.

## Validasi

Tes DOM pilihan kategori/pratinjau, filter Ice/Hot/Cup/Can, unknown suhu terpisah, ID duplikat dan pilihan promo lama. Tes SQL salinan outlet dan pewarisan metadata anak, validasi nilai penyajian. Dry run schema+pemetaan di database sebenarnya memakai ROLLBACK dan pemeriksaan kolom terlindungi. Browser lokal menguji Coffee Series 18 menu, Ice/Cup 10 menu, penambahan 10 aturan eksplisit dan klik kategori POS, desktop/mobile; POST diblokir saat QA supaya tidak menyimpan promo uji. Fixture/route QA dihapus sebelum build/deploy.

Migrasi produksi: `20261126022011_menu_coffee_series`. Seluruh 694 tes / 125 berkas lolos; typecheck dan eslint --quiet lolos. Security advisor sebelum/sesudah identik (261 temuan existing, nol temuan baru). Penerapan authenticated menghasilkan 30 log perubahan menu, 18 menu Coffee Series aktif, metadata tersedia melalui RPC Marketing tanpa kolom biaya.
