> Arsip: alur ini dinonaktifkan atas instruksi pemilik 26 Oktober 2026. Jalur aktif memakai [POS login langsung](pos-login-langsung.md). Jangan mengaktifkan kembali pengunci tanpa persetujuan baru.

# Pengecualian sementara untuk presentasi POS lengkap

Berbeda dari testing lokal yang fiturnya terbatas, pengecualian ini memakai seluruh halaman POS operasional. Transaksi, stok dan kas tetap merupakan data asli. Login outlet, perangkat yang sah, satu kas/perangkat, PIC aktif outlet, uang fisik serah terima, harga dan pencatatan transaksi tetap diperiksa. Tidak membuat absensi atau jadwal palsu.

Selama interval presentasi, dropdown PIC memuat petugas kasir/barista/SPV outlet aktif tanpa mengharuskan Clock In atau kecocokan jam shift. Konteks shift memakai jadwal terbit tanggal operasional outlet yang tersedia. Batas izin tetap berakhir paling lambat di akhir presentasi. Kehadiran normal berlaku lagi setelah interval selesai; status maupun checkout tidak boleh mengandalkan flag frontend saja.

HRD sesuai outlet dan Owner/Admin Pusat dapat mengakhiri lewat **Akses Kasir POS per Outlet → Kembalikan aturan shift**. RPC `atur_presentasi_pos` memeriksa kewenangan aktual dan membatasi durasi maksimal 120 menit. Riwayat interval serta audit disimpan privat, tanpa grant tabel. Mengakhiri memakai interval akhir eksklusif agar izin langsung berhenti, termasuk dalam transaksi database yang sama. Interval historis tetap tersedia untuk pemeriksaan waktu transaksi offline.

Kominot diaktifkan sementara atas instruksi pemilik pada 26 Oktober 2026 sampai 13.07 WIB. Mode testing ringkas dinonaktifkan dan kas harian yang terlanjur ditutup dilanjutkan melalui RPC beralasan yang sudah tersedia, tanpa modal atau sesi kedua. Outlet lain tidak diubah.

Migrasi `20261026040452_pos_presentasi_sementara.sql` memasang perubahan pada fungsi asli dengan guard pencocokan definisi. Uji integrasi memakai mesin POS asli: semua anggota sudah Clock Out, PIC tetap bisa dipilih dan checkout benar-benar tercatat; modal tetap, tidak membuat absensi, staf tidak dapat mengaktifkan, durasi >120 ditolak, outlet lain tidak terpengaruh, dan setelah dihentikan status/checkout kembali menolak tanpa tim bertugas. Seluruh transaksi pengujian lokal di-ROLLBACK.
