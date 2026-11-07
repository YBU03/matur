# Jadwal ringkas di Karyawan Outlet

Menggantikan tampilan tujuh kartu hari di dashboard mitra. Susunan halaman
/portal/karyawan sekarang profil karyawan terlebih dahulu, lalu Jadwal Shift.
Komponen dipindahkan dari folder dashboard ke portal/karyawan. Dashboard utama
tidak lagi memuat panel jadwal.

Bawaan tanggal hari ini WIB; panah sebelumnya/berikutnya menggeser tepat satu
hari, termasuk lintas minggu/bulan. Tombol Hari ini mengembalikan pilihan. URL
memakai mitra_tanggal dan mitra_outlet pada /portal/karyawan, tanpa membawa
parameter mitra_minggu lama. Tautan memakai scroll=false agar posisi baca tetap.
Filter outlet hanya ditampilkan jika lebih dari satu outlet milik mitra.

Tampilan berupa daftar kompak (nama, outlet bila perlu, jam shift, status,
jam masuk/pulang), bukan tujuh kartu hari. Ringkasan kecil Bertugas sekarang dan
penanda per staf hanya tampil untuk konteks hari ini. Tetap memakai dasar
absensi terbuka 24 jam terakhir; data absensi kemarin yang masih aktif tetap
terlihat di ringkasan hari ini. Jam lewat tengah malam ditandai +1 hari.

Tidak mengubah database, jadwal HRD, absensi, atau izin. RPC mingguan yang sudah
terbatas pada outlet mitra dipakai untuk mengambil minggu berisi tanggal pilihan;
hanya satu tanggal ditampilkan. Pembatasan akses tetap pada server/RPC.
Penyegaran berkala dipasang di halaman Karyawan Outlet (sebelumnya milik dashboard).

Validasi: uji browser komponen asli dengan fixture lokal meliputi satu tanggal,
prev/next melewati Minggu–Senin, tombol Hari ini, filter outlet, status telat/libur,
shift malam dan aktif; viewport 1440/390/320 tanpa overflow dan panel di bawah
700 piksel untuk tiga baris contoh. Tes tanggal memastikan pilihan hari tidak
dibulatkan ke Senin. Halaman/rewrite QA dipulihkan sebelum commit.

Hasil tes akhir: seluruh 425 tes / 69 berkas lulus. TypeScript, lint dan build
produksi diperiksa; sumber database dan kewenangan tidak diubah.
