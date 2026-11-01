# Tampilan HRD — 1 November 2026

Hanya perubahan tampilan; tidak ada perubahan database, aturan jadwal, absensi, atau gaji.

- **Jadwal Shift** (`/jadwal`, tab Kalender): pilihan **Bulanan** (kalender Senin–Minggu, chip inisial nama berwarna per shift, garis putus = draft, titik merah = kurang orang, 🌴 libur, 📝 izin; klik tanggal → panel kanan berisi kartu hari yang sama dengan semua aksi edit) dan **Mingguan** (7 kartu hari per minggu dalam bulan). Kartu hari dipakai bersama (`kartuHari`) sehingga aksi tambah/ubah/libur/izin tetap sama. Grafik "Pembagian shift per staf".
- **Rekap Absensi** (`/absensi`): grafik kehadiran harian, komposisi periode, menit telat terbanyak, jam kerja per staf (`absensi/grafik.tsx`). Baris detail memakai tombol 👁 Lihat (popup foto masuk/pulang, lokasi, catatan; foto bisa diperbesar) dan ✏️ Edit (modal; memakai `editAbsensi` dengan alasan wajib, termasuk hapus).
- **Persetujuan** (`/persetujuan`): header seragam, kartu angka, grafik izin/sakit/libur per minggu, tombol Setujui/Tolak baru.
- Kelas tombol seragam: `tombolAksi` di `src/components/ui-halaman.tsx`.
