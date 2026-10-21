# Kehadiran hari ini: penyajian visual

`RingkasSdm` tetap memakai loader dan `hitungRekap` yang sama. Tidak mengubah toleransi telat, perhitungan, izin, data, hak akses, atau database. UI dipisahkan ke `kehadiran-hari-ini.tsx`.

- Kartu ringkasan terjadwal, sedang bertugas, tepat waktu, telat dan belum absen.
- Outlet dengan catatan ditampilkan lebih dulu; semua outlet tetap ada. Kartu kosong mengikuti isi, tidak mengikuti tinggi kartu lain.
- Nama, shift/jadwal, badge status, jam masuk dan pulang (WIB) langsung terlihat tanpa buka/tutup detail. Tepat waktu hijau, telat merah beserta `telat_menit` asli. Belum absen kuning; tidak absen merah, izin/sakit biru, tanpa jadwal/libur netral.
- Status masuk tetap terlihat setelah pulang, dengan label tambahan Sudah pulang. Sesi berganda tidak digabung/dihapus; diberi Sesi 1/Sesi 2. Angka ringkasan tetap menghitung catatan/sesi seperti sebelumnya, bukan jumlah orang unik.
- Nama/label status menjadi informasi utama, warna hanya pendukung. Jam yang belum tercatat ditampilkan tanda pisah.
- Desktop: karyawan dua kolom di dalam outlet. Mobile: satu kolom. Tombol rekap dan tindakan izin/tukar/jadwal draft tetap tersedia.

Browser lokal dengan fixture contoh memverifikasi 1280×900, 390×844 dan lebar 320 px tanpa overflow horizontal, badge hijau/merah, waktu WIB, sesi berganda, dan outlet kosong. Screenshot lokal tersimpan di work/attendance-qa. Route preview hanya dipakai lokal dan dihapus sebelum build; tidak diikutkan ke produksi. Tidak menggunakan data atau akun produksi.

Validasi akhir: 2 tes rekap yang sudah ada lulus; ESLint file terkait, TypeScript dan build produksi lulus. Warning lama simulasi-view.tsx:80 tetap ada.
