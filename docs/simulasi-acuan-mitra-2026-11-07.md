# Simulasi acuan dan kontak karyawan mitra

Simulasi Kemitraan tetap tersedia untuk Owner/Admin Pusat/Finance. Pilihan acuan
berupa dropdown satu outlet/Semua Outlet, satu bulan, tiga bulan sampai bulan
pilihan, atau rentang bulan awal-akhir. Bulan awal bawaan mengikuti laporan
terbaru yang tersedia. Tombol Gunakan sebagai acuan hanya mengisi penjualan,
HPP dan beban; investasi, skema, pertumbuhan, dan masa proyeksi tetap. Perubahan
filter tidak menimpa asumsi manual. Seluruh input tetap dapat diedit.

Acuan bersumber dari laporan_bulanan mode asli aktif, memakai perhitungan
laporan yang sama dengan sebelumnya. Server membaca per halaman 500 agar tidak
terpotong batas default API, lalu hanya mengirim agregat outlet-bulan ke browser
(tanpa identitas karyawan / rekening dalam laporan). Semua Outlet memakai rata-rata
per laporan outlet-bulan yang tersedia, BUKAN total seluruh jaringan. HPP = total
HPP dibagi total penjualan. Beban tidak mencakup sedekah yang disimulasikan
tersendiri. Rentang kosong/terbalik diberi pesan; laporan yang tidak tersedia tidak
dianggap penjualan nol. Jumlah laporan, outlet dan kekosongan ditampilkan.

Portal Karyawan Mitra sekarang menampilkan nama, peran, No. WA dari pengguna.no_hp,
alamat teks, dan tanggal bergabung. Domisili diutamakan; alamat KTP menjadi cadangan.
Tidak menampilkan Maps, NIK, kontak darurat maupun profil lengkap. Field kosong
mendapat penanda. RPC karyawan_outlet_saya tetap membatasi pada penugasan mitra
aktif di outlet terkait. SECURITY DEFINER dipertahankan untuk proyeksi profil
terbatas (mitra tidak diberi akses baca tabel profil penuh), search_path dikosongkan,
relasi diberi schema, anon/PUBLIC tidak diberi EXECUTE. Endpoint authenticated
memang diperlukan dan tetap diperiksa kepemilikan outlet di dalam fungsi.

Migrasi produksi terpasang:
- 20261107040237_mitra_alamat_karyawan
- 20261107040425_mitra_nomor_wa_karyawan (tambahan pengguna saat pengerjaan)
Tidak mengubah nilai laporan atau data kontak karyawan.

Validasi: tes hitung acuan dan SQL Postgres lokal mencakup outlet-bulan,
HPP tertimbang, laporan kosong, lintas tahun, alamat cadangan, larangan lintas
outlet/sesi kosong/anon/mitra nonaktif. Query verifikasi produksi memakai konteks
mitra dalam transaksi rollback dan tidak mencetak data pribadi. Advisor tidak
menandai akses anon untuk RPC ini; akses authenticated SECURITY DEFINER memang
diperlukan, sudah dibatasi secara eksplisit. Temuan advisor lain yang sudah ada
tidak disentuh dalam perubahan ini.

Uji browser komponen simulasi asli (fixture lokal tanpa perubahan laporan):
filter, penerapan nilai, input manual, angka HPP setelah edit, rentang invalid,
laporan kosong, serta viewport 1440/390/320. Portal karyawan dirender dari halaman
asli dengan data uji untuk memastikan kontak/alamat dan pesan kosong tetap muat.

Hasil pemeriksaan akhir: seluruh 416 tes / 67 berkas lulus, TypeScript dan lint
lulus. Halaman QA sementara dan pengecualian middleware dipulihkan sebelum commit.
