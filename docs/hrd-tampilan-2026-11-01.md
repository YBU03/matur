# Tampilan HRD — 1 November 2026

Hanya perubahan tampilan; tidak ada perubahan database, aturan jadwal, absensi, atau gaji.

- **Jadwal Shift** (`/jadwal`, tab Kalender): pilihan **Bulanan** (kalender Senin–Minggu, chip inisial nama berwarna per shift, garis putus = draft, titik merah = kurang orang, 🌴 libur, 📝 izin; klik tanggal → panel kanan berisi kartu hari yang sama dengan semua aksi edit) dan **Mingguan** (7 kartu hari per minggu dalam bulan). Kartu hari dipakai bersama (`kartuHari`) sehingga aksi tambah/ubah/libur/izin tetap sama. Grafik "Pembagian shift per staf".
- **Rekap Absensi** (`/absensi`): grafik kehadiran harian, komposisi periode, menit telat terbanyak, jam kerja per staf (`absensi/grafik.tsx`). Baris detail memakai tombol 👁 Lihat (popup foto masuk/pulang, lokasi, catatan; foto bisa diperbesar) dan ✏️ Edit (modal; memakai `editAbsensi` dengan alasan wajib, termasuk hapus).
- **Persetujuan** (`/persetujuan`): header seragam, kartu angka, grafik izin/sakit/libur per minggu, tombol Setujui/Tolak baru.
- Kelas tombol seragam: `tombolAksi` di `src/components/ui-halaman.tsx`.

## Kartu hari gaya baris (1 November, lanjutan)
- Tiap shift: kotak dengan nama, jam, badge "x/min orang"; per orang satu baris (nama, Terbit/Draft, ✏️ `editRow`, 👤− hapus via `kelolaJadwalHarian` aksi `hapus`); bawah: pilih staf + 👤+ (`tambahJadwal`).
- Kotak hijau **Libur hari ini**: libur otomatis (tanpa shift) & libur disetujui → ✏️ `ModalLibur` (ganti/pindah), 👤− jadikan masuk (`ModalLibur` mode `masuk`) atau `batalIzinAtasan` untuk libur pengajuan; izin/sakit/libur menunggu → ✏️ modal izin. Tambah: pilih staf + jenis (Libur mingguan/Izin/Sakit) + ＋ (`catatIzinStaf`, konfirmasi bila staf punya shift).

## Riwayat harian & Jam Ramai (3 November)
- Rekap Absensi: bagian Detail per hari (`DetailHarian`): panah ‹ ›, pilih tanggal (`?tgl=`), tombol Hari ini, ringkasan hadir/telat/tidak absen/izin. Tanggal di luar periode memperluas periode filter otomatis.
- Beranda HRD "Jadwal & staf": panah ‹ › + pilih tanggal (`?hrd_tgl=`); kartu ringkasan atas tetap hari ini.
- Grafik Jam Ramai (`Heatmap` di `src/components/charts.tsx`, dipakai Dashboard POS & Pantau POS): kolom tetap 06.00–02.00 lewat tengah malam (jam di luar itu ikut tampil bila ada transaksi), baris Minggu → Sabtu. Jam 00–02 berada di baris hari operasional sebelumnya (tutup buku 03.00).
