# Hari operasional (tutup buku 03.00 WIB) — 3 November 2026

Outlet buka pagi dan tutup sampai ±02.00, jadi satu periode operasional = 03.00 WIB s.d. 02.59 WIB keesokan harinya.
- DB: `perusahaan.jam_tutup_buku` (bawaan 3), fungsi `jam_tutup_buku()`, `tgl_op(timestamptz)`, `awal_op(date)`. Migrasi `20261102233726_hari_operasional_tutup_buku.sql` mengganti batas hari kalender di `omzet_hari_ini`, `laporan_operasional`, `pantau_pos`, `pantau_pos_periode`, `ringkasan_penjualan`, `rekap_harian`, `proyeksi_laporan`, `rekap_setoran`, `persediaan_bulanan`, `tutup_kas_otomatis`. Jam pada grafik per jam tetap jam asli.
- App: `src/lib/hari-operasional.ts` (`tglOperasional`, `awalOperasional`) dipakai Riwayat POS ("Hari ini", batas void), preset Laporan POS, filter dashboard.
- Data transaksi tidak diubah (waktu asli tetap). Absensi/jadwal/gaji tetap memakai tanggal kalender (`hari_wib`). Nomor order struk `POS-ddmmyy-n` memakai tanggal transaksi asli.

## Berlaku mulai 2 November 2026
Atas permintaan pemilik, aturan 03.00 hanya berlaku mulai hari operasional **2 Nov 2026** (`perusahaan.tutup_buku_mulai`, fungsi `tutup_buku_mulai()`; app `TUTUP_BUKU_MULAI`). Sebelum itu tetap tanggal kalender, sehingga data dokumen PDF 1 Nov tetap **38 transaksi / Rp1.758.000** (dua transaksi 00.09 & 00.32 tidak pindah ke 31 Okt). Migrasi `20261102235751_hari_operasional_mulai_2nov.sql`.
