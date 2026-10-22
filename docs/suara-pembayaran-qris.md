# Suara pembayaran QRIS

Aset asli pengguna disimpan tanpa perubahan di `public/audio/pembayaran-diterima.wav`: PCM stereo 44.1 kHz, durasi 3,01 detik, 531.248 byte. Tidak ada dependensi baru. Pengaturan QRIS Outlet memiliki pemutar tes dengan `preload="none"`, tanpa autoplay. Tes suara tidak memanggil aksi pembayaran atau mengubah status transaksi.

## Status integrasi

Pengguna menyebut akan memakai QRIS langsung BNI. Saat pemeriksaan, aplikasi belum memiliki pembuatan pembayaran QRIS dinamis, webhook BNI, atau status pembayaran terverifikasi dari BNI. Mode dinamis masih diblokir oleh server dan database sampai integrasi penyedia tersedia. Tidak ada pengaturan outlet maupun data pembayaran yang diubah untuk persiapan suara ini.

## Ketika integrasi BNI tersedia

- Verifikasi konfirmasi BNI di server sesuai dokumentasi dan kredensial integrasi yang sebenarnya; jangan percaya status dari browser atau klik kasir.
- Cocokkan referensi pembayaran, outlet/transaksi, nominal dan status final berhasil, lalu simpan secara idempoten.
- POS yang sedang menunggu pembayaran itu menerima perubahan terverifikasi, menampilkan Lunas, lalu memutar aset di atas sekali per ID pembayaran. Status menunggu, gagal, kedaluwarsa, transaksi tunai, QRIS statis manual, dan pemuatan riwayat tidak memicu suara.
- Tangani notifikasi berulang dan respons polling/realtime yang sama agar tidak berbunyi ulang. Jangan menambahkan endpoint publik yang bisa menandai lunas tanpa verifikasi.
- Aktifkan audio melalui interaksi kasir sebelum menunggu QRIS; browser dapat membatasi autoplay. Jika pemutaran ditolak, status lunas tetap tampil dan sediakan tindakan mengaktifkan suara. Verifikasi pada tablet kasir sebenarnya.

Persiapan ini belum mengaktifkan pemutaran otomatis saat pembayaran. Penyambungan membutuhkan integrasi pembayaran BNI, bukan sekadar gambar/payload QRIS atau Merchant ID.

Validasi persiapan: lima tes QRIS yang sudah ada, ESLint berkas pengaturan, dan production build lulus. WAV diperiksa sebagai PCM stereo 44.1 kHz dengan durasi 3,01 detik. Belum menguji konfirmasi pembayaran BNI atau keluaran speaker pada tablet fisik.
