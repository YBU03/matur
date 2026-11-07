# Dropdown bulan dan jadwal mingguan mitra

Simulasi Kemitraan memakai dropdown otomatis untuk bulan tunggal, bulan akhir
acuan tiga bulan, serta bulan awal/akhir kustom. Pilihan berasal dari periode
laporan yang tersedia untuk outlet terpilih (gabungan bulan untuk Semua Outlet),
berlabel nama bulan Indonesia. Jika pilihan lama tidak tersedia setelah ganti
outlet, bulan diisi otomatis dari pilihan yang ada. Rentang kustom bawaan mencakup
bulan tersedia; data kosong menonaktifkan dropdown. Tidak ada input bulan manual.
Filter tetap tidak menimpa asumsi sampai Gunakan sebagai acuan diklik.

Dashboard mitra menambahkan Jadwal Shift Mingguan: tujuh kartu Senin–Minggu,
penanda Hari ini, outlet, nama, jam shift (termasuk penanda +1 hari), status
hadir/terlambat/selesai, serta izin/sakit/libur yang sudah disetujui. Jadwal draft
tidak ditampilkan. Semua Outlet Saya/satu outlet dan minggu sebelum/berikutnya
tersedia; parameter mitra_minggu/mitra_outlet terpisah dari filter laporan.
Tidak ada tombol/izin edit, hapus atau terbitkan jadwal untuk mitra.

Panel Sedang bertugas sekarang terpisah dari minggu yang dipilih. Dasarnya absensi
masuk <= sekarang, belum pulang, dalam 24 jam terakhir (termasuk malam kemarin).
Absensi lama tidak terus dianggap aktif. Keterangan ini ditampilkan di panel;
rekaman clock-in terbuka bukan bukti lokasi fisik langsung. Data diperbarui lewat
mekanisme refresh dashboard mitra yang sudah ada (cadangan 60 detik/fokus tab),
tanpa menambah polling kedua atau memperluas RLS absensi.

RPC public.jadwal_mitra_mingguan(date) adalah SECURITY INVOKER yang memanggil
mitra_dashboard_internal.jadwal(date), SECURITY DEFINER dengan search_path kosong.
Pemilik outlet ditentukan dari auth.uid(), pengguna aktif, penugasan mitra dan
outlet asli tidak diarsipkan. Tidak menerima id mitra yang bisa dipalsukan. Hanya
kolom nama/outlet/jam/status yang diproyeksikan: tidak ada foto absensi, koordinat,
alasan izin atau catatan internal. EXECUTE tidak diberikan kepada anon/PUBLIC.
Hak edit HRD dan tabel asli tidak diubah. Migrasi produksi:
20261107043012_jadwal_mitra_mingguan.

Validasi: SQL lokal Postgres menguji dua mitra terpisah, draft, persetujuan izin,
absensi terbuka 12/25 jam, sesi kosong, staf, pengguna nonaktif serta hak anon.
Query produksi memverifikasi batas outlet/kolom/hak dalam transaksi rollback tanpa
mencetak data pribadi. Advisor tidak memberi temuan terkait endpoint/skema baru.
Uji browser memakai komponen asli dan fixture lokal: dropdown bulan otomatis,
periode kosong/terbalik, angka acuan, pergantian outlet/minggu, tujuh hari,
libur/telat/shift malam, dan lebar 1440/390/320 tanpa overflow. Rewrite/halaman
QA lokal dipulihkan sebelum commit; tidak ikut produksi.

Pemeriksaan akhir: 424 tes / 69 berkas lulus; TypeScript dan lint lulus.
