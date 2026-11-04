# Pembayaran Platform Online — 4 November 2026

## Perilaku POS

Metode langsung tetap Tunai, QRIS, Debit/Kredit, Transfer. Tombol Platform Online membuka dropdown GrabFood, GoFood, ShopeeFood, TikTok Go, dan Ruma App. Memilih kanal platform menyarankan metode sesuai kanal; kasir bisa mengganti metode sebelum Bayar. Beralih dari kanal platform ke Langsung/Tumbler menghapus saran platform lama dan kembali Tunai, sementara metode langsung yang dipilih manual dipertahankan. Draft memakai saran yang sama saat dibuka. Split bayar menyediakan kelompok Pembayaran langsung dan Platform Online.

Platform hanya tersedia saat online, sebagaimana metode non-tunai yang sudah ada. Ini pencatatan manual kasir atas pembayaran platform, bukan integrasi API/konfirmasi otomatis platform. Harga tetap mengikuti kanal pesanan yang sudah ada, bukan metode penerimaan dana.

## Data, kas, akunting

Enum pembayaran diperluas secara aditif. GrabFood dan Shopee-Pay historis dipertahankan; ShopeeFood adalah metode terpisah dari Shopee-Pay. Kanal tetap terpisah dari metode. Tidak ada backfill atau perubahan transaksi lama.

Penyimpanan tetap memakai checkout asli, split divalidasi sama dengan total pesanan dan idempotensi tetap berlaku. Kas laci hanya menjumlahkan metode tunai; platform masuk non-tunai. Omzet mengikuti transaksi lunas sekali, bukan menjumlahkan ulang setiap bagian pembayaran. Void tidak ikut omzet/kas. Laporan POS metode bayar, riwayat, dan semua format struk memakai label yang konsisten. Laporan keuangan yang ada tetap mengikuti kanal, subtotal/diskon, dan pembayaran yang tersimpan; tidak dibuat pendapatan kedua. Pencairan/komisi platform tidak diotomatisasi atau diasumsikan; harus dicatat terpisah dengan bukti.

## Validasi

Uji SQL lokal menjalankan checkout asli untuk lima metode platform, idempotensi, split tunai+GoFood, perhitungan laci, dan pengecualian void. Seluruh data fixture lokal di-rollback. Unit struk memeriksa kelima nama platform dan kompatibilitas Shopee-Pay. Uji browser PosScreen asli dengan data fiktif: saran kanal, ganti platform, kembali tunai, semua opsi dropdown/split, reset saran kanal, HP 390px/desktop 1366px, dan penguncian non-tunai saat offline. Tidak ada transaksi uji yang disimpan ke produksi.

Hasil pemeriksaan: 380 tes pada 61 berkas lolos; TypeScript dan lint tanpa error. Migrasi aditif telah diverifikasi di Supabase; sepuluh nilai metode (termasuk metode lama) tersedia. Tidak ada perubahan hak akses, fungsi transaksi, atau data transaksi historis.

Build produksi gabungan dengan versi repo terbaru berhasil.
