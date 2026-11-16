# HRD, rekening gaji, dan Data Void

- Pendaftaran tidak memerlukan penanda karyawan. HRD melihat semua akun menunggu non-tablet; Admin Gudang tetap hanya pendaftar staf. Persetujuan HRD tetap kasir/barista, outlet asli aktif wajib. RPC mengunci pendaftar, menolak akun yang sudah diproses/ditugaskan.
- Profil karyawan memiliki Rekening Gaji (bank, nomor rekening teks, atas nama). RPC sempit hanya menulis tiga data rekening milik pengguna aktif sendiri, memakai gaji_staf sebagai sumber penggajian. Komponen gaji dan slip final tidak diubah.
- Data Void tersedia di dashboard peran pembaca laporan, Ruang Karyawan → Lainnya, dan tab Void pada tablet POS. Pembatasan outlet tetap RLS; SPV/karyawan/tablet juga dipaksa ke outlet aktif di server.
- Periode hari ini, kemarin, tujuh hari terakhir, atau kustom maksimal 367 hari. Periode berdasarkan void_at WIB; created_at ditampilkan terpisah. Rekaman tanpa waktu void tidak dimasukkan ke periode; rincian UUID tetap dapat membacanya dengan label waktu tidak tercatat.
- Jumlah transaksi dan nominal neto dihitung satu kali per transaksi; jumlah menu dan nilai menu sebelum diskon dihitung dari snapshot item, bukan master menu saat ini. PDF dan Excel memakai baris filter yang sama; semua nominal IDR.
- Notifikasi menuju /void?transaksi=UUID lalu dialihkan sesuai peran. Notifikasi lama dipetakan hanya jika waktu pembatalan, outlet, dan nomor cocok unik. Mekanisme void, stok, pembayaran, QRIS, dan pembukuan biaya tidak berubah.

Validasi: pengujian PGlite persetujuan HRD, rekening pribadi/salary tetap, RLS outlet dan anonymous; rekap diskon dan tanggal Jakarta; uji tampilan desktop/ponsel; PDF dan Excel dengan data sintetis; pembacaan read-only database produksi dan security advisor.
