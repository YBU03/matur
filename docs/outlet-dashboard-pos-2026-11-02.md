# Switch tampilan outlet di Dashboard POS

Menu Outlet (`/master/outlet`), pada masing-masing kartu: **Tampilkan di Dashboard POS**. Tombol hijau ON — Ditampilkan dan merah OFF — Disembunyikan, dengan ikon dan teks agar status tidak bergantung pada warna. Khusus peran aktif Owner/Admin Pusat. Status operasional outlet, login kasir, penugasan, transaksi, stok dan riwayat tetap terpisah.

Kolom `outlet.tampil_dashboard_pos` default true; Outlet Demo (uji coba) disetel false sesuai persetujuan pemilik. Kominot dan UHB tetap true. RPC `atur_tampil_dashboard_pos` SECURITY INVOKER memeriksa izin, RLS outlet lama dan nilai sebelumnya untuk menolak perubahan stale. Tombol dikunci selama permintaan, baru berubah setelah server mengonfirmasi; kegagalan ditampilkan. Tidak ada konfirmasi tambahan karena toggle dapat dibalik.

Dashboard POS menyaring daftar outlet di server, sehingga URL lama untuk outlet tersembunyi juga kembali ke gabungan outlet yang ditampilkan. Agregat `ringkasan_penjualan` dan `omzet_hari_ini` saat tanpa outlet menyaring sumber transaksi dan kas sebelum menghitung KPI, periode pembanding, tren, jam, kategori, menu, serta perbandingan outlet. Ini juga menyelaraskan kartu omzet Beranda. Ringkasan dengan ID eksplisit tetap dapat digunakan halaman detail outlet/riwayat. Pemantauan POS/Tamu Matoer menyaring daftar dan seluruh agregatnya. Jika semua OFF, dashboard menghasilkan nol dan menampilkan tautan menuju menu Outlet.

Laporan POS/Finance: dropdown default outlet yang ditampilkan; checkbox **Sertakan outlet yang disembunyikan** menampilkan kembali pilihan yang memang boleh dibaca pengguna sesuai RLS. Pilihan dipertahankan saat mengganti periode/filter. Fungsi laporan historis tidak diubah dan tidak menghapus penjualan. Laporan keuangan bulanan tetap menggunakan sumber semula. Data Demo tidak dikeluarkan dari pembukuan atau ditandai sebagai transaksi batal.

## Verifikasi

- `supabase/tests/outlet_tampil_dashboard_pos.sql`: uji authenticated Owner OFF/ON, stale edit ditolak, seluruh outlet OFF menghasilkan nol, kartu omzet sesuai transaksi yang terlihat, HRD/anon ditolak; semua toggle pengujian di-ROLLBACK.
- Tanggal 1 November: dashboard gabungan OFF Demo = 38 transaksi/Rp1.758.000; ON Demo = 47/Rp1.999.000. Laporan eksplisit Demo tetap 9 transaksi. Setelah rollback Demo tetap OFF.
- Browser lokal memakai komponen kartu Outlet asli: tampilan warna/status/label, tombol terkunci saat menyimpan, kegagalan tidak mengganti nilai; layar 390px tidak overflow. Pengujian browser memakai pratinjau tanpa login; keberhasilan simpan berizin diverifikasi melalui SQL authenticated, bukan akun palsu di browser.
- Unit test peran aktif Owner/Admin Pusat diizinkan; HRD/Finance/Gudang/tablet/tanpa sesi ditolak sebelum query; OFF boolean false tersimpan dengan benar; error stale tidak dianggap berhasil.
- Halaman QA dan pengecualian middleware dihapus. TypeScript, lint, 356 tes pada 56 file, serta build lolos sebelum deploy. Security advisor tidak menemukan temuan baru pada RPC switch.

Migrasi: `20261102090514_outlet_tampil_dashboard_pos.sql`. UI: `outlet-dashboard-switch.tsx`, integrasi kartu master Outlet, filter dashboard dan checkbox Laporan POS. Pengaturan dapat dipulihkan dengan switch ON; tidak perlu mengimpor ulang data.
