# Rekonsiliasi kas dan pemeriksaan transaksi — 17 November 2026

Catatan Harian → buka tanggal → **Periksa & rekonsiliasi kas**. Owner/Admin Pusat/Finance dapat melihat penjualan tunai, pengeluaran yang terhubung, penyerahan uang, modal, setoran aktual, dasar hitung terkini dan angka tersimpan. Daftar pengeluaran mencakup tanggal tersebut serta pengeluaran tanggal lain yang terhubung ke shift. Pengeluaran tanpa shift atau berbeda tanggal diberi alasan yang dapat ditindaklanjuti.

**Perbaiki pengeluaran** mengizinkan tanggal operasional, nominal, sumber laci/pusat dan shift tujuan. Pratinjau menampilkan sebelum/sesudah seluruh shift terdampak. Simpan membutuhkan alasan dan sidik yang masih cocok; menolak kas aktif, pending offline, tujuan beda outlet/mode/tanggal dan layar kedaluwarsa. Nominal/tanggal pembelian terkait penerimaan stok tetap dilindungi oleh trigger yang ada. Koreksi hubungan shift tidak membuat biaya atau mutasi stok baru. Riwayat perbaikan disimpan di log aktivitas, termasuk pelaku, alasan dan nilai lama/baru.

Setoran aktual tetap dipertahankan. Rumus: setoran seharusnya = pembayaran tunai transaksi lunas dalam sesi − biaya laci aktif dalam sesi − penyerahan uang. Modal tidak dikurangi dua kali: kas fisik seharusnya mencakup modal, setoran tidak. Koreksi satu biaya menghitung ulang kedua sesi bila dipindah. Semua laporan yang membaca sesi_kas/rekap_harian mengikuti hasil tersimpan yang sama. Rekap bulanan yang sudah diterbitkan tidak ditimpa otomatis.

Revisi aktual menampilkan modal dan setoran setelah revisi serta petunjuk memakai rekonsiliasi bila pengeluaran salah hubungan. Pemilihan hari kartu memakai tanggal_shift, dengan fallback WIB untuk kas lama. Pengeluaran baru hanya ditempel ke satu kas aktif jika tanggal operasional sesuai. Entri historis/ambigu tidak diam-diam ditempel ke kas hari ini; muncul peringatan untuk diperiksa.

## Pemeriksaan transaksi

Penanda “transaksi perlu dicek” di kartu dan tabel bisa diklik langsung ke filter pemeriksaan. Alasan menunjukkan asal pesanan dan metode pembayaran yang tidak cocok, bukan tuduhan uang kurang. Panel mencantumkan nomor, waktu, kasir, item dan pembayaran. Akunting dapat memperbaiki kanal/metode menggunakan alur koreksi yang sudah ada atau memilih **Sudah dicek — data benar** dengan alasan wajib.

Verifikasi tidak mengubah transaksi, pembayaran, omzet, stok atau selisih kas. Nama pemeriksa, waktu dan alasan tersimpan. Transaksi yang telah diverifikasi keluar dari hitungan kuning dan dapat dilihat melalui filter **Sudah diverifikasi**. Sidik meliputi transaksi, pembayaran dan item; trigger membatalkan status aktif setelah perubahan, termasuk jika nilainya kemudian dikembalikan. Riwayat verifikasi tetap tersimpan di schema privat. RPC baru publik memakai SECURITY INVOKER, implementasi privat memiliki pemeriksaan akun/peran/outlet, tidak ada akses anon atau akses tabel langsung.

## Koreksi data Kominot yang disetujui

Empat biaya hanya diperbaiki hubungan sesinya; tanggal, nominal dan setoran aktual tidak diubah:
- Tambahan es kristal Rp24.000 tanggal 5 Nov: dari shift 6 ke shift 5.
- Gold whipping rich Rp65.000 tanggal 6 Nov: dihubungkan ke shift 6.
- Zoda Rp10.000 tanggal 7 Nov: dari shift 11 ke shift 7.
- Donat croissant Rp26.000 tanggal 7 Nov: dihubungkan ke shift 7.

Hasil: 6 Nov Rp807.500, 7 Nov Rp1.093.000, 11 Nov Rp599.000 — masing-masing selisih nol. Dampak nyata di 5 Nov: setoran tersimpan Rp688.500, seharusnya Rp664.500, lebih Rp24.000. Selisih ini sengaja tetap terlihat untuk pemeriksaan; tidak dinolkan melalui penyesuaian fiktif. Bukti sebelum koreksi tersimpan di handoff lokal, audit sebelum/sesudah tersimpan di database.

## Validasi

Uji PGlite memakai fungsi rekap/rincian asli dan migrasi baru: pratinjau tanpa perubahan, perpindahan biaya dua shift, biaya belum terhubung, setoran aktual tetap, retry/stale preview ditolak, akses anon/barista ditolak, pending offline, target lintas outlet/tanggal, pembelian stok dilindungi, penempelan tanggal lama aman, verifikasi tidak mengubah uang dan batal setelah edit/revert. Uji helper menjelaskan alasan transaksi dan biaya dengan tepat.

Pemeriksaan server produksi juga menjalankan inspector, rincian 82 transaksi tanggal 14 Nov, dan rekap 17 hari; verifikasi pada satu transaksi bertanda diuji dalam transaksi ROLLBACK, sidik transaksi/pembayaran tetap sama. Pengujian browser lokal diblokir kebijakan browser; interaksi visual tidak diklaim teruji end-to-end dalam sesi ini. Build, TypeScript, ESLint dan 529 tes lolos; tes spesifik diulang setelah penyesuaian nama kolom waktu log produksi.
