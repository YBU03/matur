# Brand dan katalog outlet — 23 November 2026

Owner/Admin Pusat: `/pengaturan/usaha`, master brand `/master/brand`.

- Brand + konsep pada Master Outlet; kategori bahan menerima teks/saran, tidak terbatas kopi.
- Outlet yang sudah ada mempertahankan katalog bersama lama. Migrasi tidak menyalin atau mengubah menu, harga, resep, stok maupun transaksi existing. RUMA dikenali melalui nama outlet untuk pengisian brand awal; lainnya dapat disesuaikan admin.
- Outlet baru default katalog mandiri kosong. Menu Master mempunyai outlet_id opsional; NULL berarti katalog bersama lama, tidak otomatis tersedia di outlet baru.
- Penyiapan awal memilih kosong/salin outlet lain. Hanya outlet tanpa transaksi dan tanpa menu khusus. Salinan ber-ID baru mencakup menu, kemasan, varian, resep, referensi HPP dan komposisi titipan. Bahan master tetap bersama, jumlah stok/pembelian/histori/promo/akses/perjanjian tidak disalin.
- Mengubah resep/harga menu salinan tidak mengubah sumber. Mengubah harga bahan master bersama tetap memengaruhi semua resep yang memakai bahan itu; gunakan bahan baru bila barang/satuan berbeda.
- Outlet produksi lama tetap menggunakan katalog bersama; migrasi otomatis menjadi katalog independen bagi outlet yang telah punya transaksi sengaja tidak dilakukan. Menu khusus baru dapat ditambahkan; tidak ada override otomatis harga menu bersama.
- Kasir membaca katalog sesuai outlet (termasuk jalur shift opsional), transaksi memeriksa kepemilikan menu lagi di database, sehingga izin harga lama tidak dapat menjual menu outlet lain.
- Kemasan baru dari editor varian mewarisi outlet induk. Menu existing tidak boleh dipindah kepemilikan; nama/ID histori tetap stabil.
- Permintaan salin idempoten berdasarkan UUID+payload+aktor. Pemilihan sumber baru memakai UUID baru; retry respons hilang mempertahankan UUID di komponen (bukan persist offline).
- HPP dapat difilter `?outlet=UUID`; jalur tambah menu diarahkan ke Master Menu dengan outlet terpilih, agar tidak membuat menu bersama tanpa sengaja.
- Pengaturan bahan/stok, struk, promo, pembelian serta keuangan memakai panel existing. Tidak menambah polling, mengubah skema mitra, mengaktifkan pengunci POS atau membuka outlet/akun kasir otomatis.

Validasi: tes SQL pemisahan katalog, salinan graph & retry, harga/resep sumber tetap, penjagaan kemasan, hak kelola dan histori; dry-run transaksi rollback dengan katalog UHB aktual 48 menu, perbandingan hash katalog existing sebelum/sesudah identik. Tidak ada outlet dummy disimpan. Uji fisik tablet/printer tidak dilakukan.
