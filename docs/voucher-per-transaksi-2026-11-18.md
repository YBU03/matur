# Voucher per transaksi — 18 November 2026

Voucher nominal tetap dipotong sekali per transaksi, terpisah dari diskon per item dan harga akhir per menu. Menu dan varian tetap menentukan kelayakan. Minimum belanja dihitung dari subtotal menu yang memenuhi syarat sebelum diskon. Potongan dibatasi subtotal yang memenuhi syarat; transaksi biasa tidak boleh menghasilkan pembayaran nol.

Kuota voucher dihitung satu transaksi. Retry memakai reservasi yang sama; void melepaskan kuota. Mengganti cakupan promo melepas reservasi lama agar hitungan sebelumnya tidak dipakai. Snapshot menyimpan cakupan untuk struk dan laporan. Kasir, struk, dan laporan marketing memberi label voucher sekali per transaksi. Tidak ada pencatatan biaya ganda.

## Sambas

Konfigurasi aktual diperbaiki menjadi voucher Rp15.000 sekali per transaksi, minimum Rp15.001 (dapat diubah), versi 4. Outlet Kominot dan UHB serta periode yang ada dipertahankan. Saat koreksi belum ada transaksi lunas atau reservasi aktif Sambas. Riwayat pembayaran tidak diubah.

Contoh: Rp20.000 + Rp28.000 = Rp48.000, voucher Rp15.000, bayar Rp33.000. Tiga minuman subtotal Rp68.000 tetap hanya dipotong Rp15.000, bayar Rp53.000. Promo harga akhir Trial Opening tetap per item.

## Validasi

549 pengujian pada 94 berkas lulus; TypeScript, lint, dan build produksi berhasil. Fixture database produksi dengan autentikasi tablet memverifikasi Rp48.000 menjadi Rp33.000, kuota, retry, void, dan laporan, kemudian ROLLBACK. Security advisors tidak menambah temuan. Pengujian visual browser belum dilakukan karena akses browser diblokir kebijakan sesi.
