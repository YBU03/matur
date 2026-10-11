# Roadmap Pengembangan Bertahap — Matur

Mengikuti PRD *Matur – Sistem Terintegrasi Coffeeshop*. Fase 1 PRD (operasional outlet)
dan Fase 2 (keuangan & mitra) dipecah menjadi tahap kecil supaya tiap sesi
pengembangan selesai, bisa dicoba, dan tidak menghabiskan kuota sekaligus.

| Tahap | Isi | Kode PRD | Status |
|---|---|---|---|
| **1** | Kerangka Next.js + Tailwind, logo & maskot, login satu halaman (password / PIN), pemilih peran & outlet, dashboard per peran, komponen konfirmasi edit & hapus 2 tahap, skema awal Supabase | AKS-01, 05, 06 · MST-01/02 (skema) | ✅ Selesai |
| 2 | Sambungkan Supabase Auth + RLS, OTP owner/mitra, CRUD data master (outlet, mitra & perjanjian, pengguna, karyawan, menu/varian, resep, bahan, supplier, kategori biaya), log aktivitas & tempat sampah | AKS-02–08, MST-01–08 | ⏳ |
| 3 | POS kasir (PWA, offline IndexedDB), kanal & metode bayar, diskon/void PIN SPV, struk, layar barista | POS-01–09 | |
| 4 | Shift & absensi (buka/tutup shift, setoran kas, jadwal, izin/cuti, rekap) | SFT, ABS | |
| 5 | Gudang & stok (pembelian, kiriman, penerimaan, potong stok via resep, opname, waste, transfer) | GDG-01–09 | |
| 6 | Dashboard pusat (grafik) + Akunting & **laporan mitra format resmi** (PDF/Excel, tutup buku, transfer) | DSB, AKT | |
| 7 | Penggajian & slip gaji | GJI-01–06 | |
| 8 | Portal mitra (laporan, BEP), proyek pembangunan, mode simulasi | MTR, PRY, SIM | |

Uji penerimaan laporan: angka periode **Agustus 2026 Ruma Kopiaksa** harus sama
persis dengan laporan manual (laba bersih Rp32.181.189, bagi hasil mitra Rp17.699.654).

## Pertanyaan terbuka (dari PRD, perlu dijawab sebelum Tahap 3/6)
- Pendapatan ojol dicatat bruto atau neto? Isi baris "Pendapatan Lain-Lain"?
- Kiriman pusat dinilai harga beli pusat atau ada markup?
- Sewa tidak dihitung dalam BEP (default) — konfirmasi.
- Penandatangan laporan & tanda tangan digital?
- Jam 3 shift tiap outlet & toleransi terlambat?
- Batas diskon kasir tanpa PIN SPV?
