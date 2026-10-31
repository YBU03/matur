# POS: Riwayat & struk salinan — 31 Oktober 2026

Disetujui pemilik ("oke gas"). Tidak ada perubahan database atau mesin transaksi.

- `/kasir/riwayat?dari=YYYY-MM-DD&sampai=YYYY-MM-DD&n=…`: preset Hari ini/Kemarin/7 hari/30 hari/Bulan ini/Bulan lalu, custom tanggal & custom bulan; maks 92 hari, daftar 100 per muat (maks 1000). Ringkasan periode (lunas, omzet, per metode, void) dihitung dari seluruh periode per 1000 baris.
- Klik transaksi → `ReceiptDialog` mode `salinan` (tanda SALINAN / VOID + alasan, waktu transaksi asli WIB, kembalian dari `pembayaran.diterima`). Tombol: WhatsApp, Cetak Bluetooth/RawBT, ⬇ Unduh PDF, Cetak browser. Void hanya ditawarkan untuk transaksi hari ini (aturan server tetap: kas masih buka + PIN SPV).
- `src/lib/struk-pdf.ts`: PDF 58/80 mm dengan kolom sama seperti ESC/POS. Tombol Unduh PDF juga ada di layar "Transaksi berhasil". Tidak ada cetak otomatis.
