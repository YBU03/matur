# Roadmap Pengembangan Bertahap — Matoer

Mengikuti PRD *Matur (kini Matoer) – Sistem Terintegrasi Coffeeshop*. Fase 1 PRD (operasional outlet)
dan Fase 2 (keuangan & mitra) dipecah menjadi tahap kecil supaya tiap sesi
pengembangan selesai, bisa dicoba, dan tidak menghabiskan kuota sekaligus.

| Tahap | Isi | Kode PRD | Status |
|---|---|---|---|
| **1** | Kerangka Next.js + Tailwind, logo & maskot, login satu halaman (password / PIN), pemilih peran & outlet, dashboard per peran, komponen konfirmasi edit & hapus 2 tahap, skema awal Supabase | AKS-01, 05, 06 · MST-01/02 (skema) | ✅ |
| **2** | Supabase (project `matur`, Singapura) + login sungguhan & RLS, CRUD data master (outlet, mitra, perjanjian & investasi awal, karyawan, kategori menu, menu, varian, resep, bahan, supplier), kategori biaya sesuai format laporan, log aktivitas, tempat sampah + pulihkan | AKS-03–07, MST-01–08 | ✅ |
| **3** | Kelola pengguna & akses (buat akun, password/PIN, tambah/cabut peran), login OTP email untuk mitra/PIC, POS kasir (kanal, varian, diskon dengan batas, metode bayar, struk cetak/WhatsApp), buka shift + modal laci, antrean barista, HPP teoritis per transaksi | AKS-02, POS-01–07 | ✅ |
| **4** | **Prioritas launching November:** proyek pembangunan (budget vs realisasi, RAB, pekerjaan + PIC + bobot, progres tertimbang, galeri foto, timeline), PIC lapor progres + foto, persetujuan Admin Pusat, portal mitra memantau pembangunan; menu mitra lain dikunci | PRY-01–05, MTR-01 | ✅ |
| 5 | Tutup shift & setoran kas, absensi & jadwal, izin/cuti · sisa POS: mode offline (PWA/IndexedDB), split payment/bill, void & diskon dengan PIN SPV, printer thermal langsung | SFT, ABS, POS-03/04/08 | |
| 6 | Gudang & stok (pembelian, kiriman, penerimaan, potong stok via resep, opname, waste, transfer) | GDG-01–09 | |
| 7 | Dashboard pusat (grafik) + Akunting & **laporan mitra format resmi** (PDF/Excel, tutup buku, transfer) | DSB, AKT | |
| 8 | Penggajian & slip gaji | GJI-01–06 | |
| 9 | Portal mitra (laporan bulanan, BEP), mode simulasi | MTR-02–06, SIM | |

Uji penerimaan laporan: angka periode **Agustus 2026 Ruma Kopiaksa** harus sama
persis dengan laporan manual (laba bersih Rp32.181.189 ✅; bagi hasil mengikuti laporan terbit: 2 × 5% = Rp3.218.118, bukan angka contoh PRD Rp17.699.654).

## Pembaruan
- Nama aplikasi menjadi **Matoer** (domain "matur" sudah dipakai pihak lain).
- Dashboard visual (DSB-01..05): pilih cabang + periode, kartu KPI dengan perbandingan periode sebelumnya, tren omzet per outlet, perbandingan cabang, komposisi kanal, menu terlaris & kurang laku, heatmap jam ramai, progres pembangunan; mitra/PIC melihat grafik progres pekerjaan dan estimasi vs realisasi.
- Data simulasi (mode `simulasi`, ±75 hari, 2 outlet) untuk mencoba dashboard; aktifkan dengan centang "Data simulasi" (Owner/Admin Pusat). Tidak pernah tampil di POS, data master, maupun laporan asli.

- Laporan keuangan resmi Juni–September 2026 outlet pertama (Ruma Kopi Usman Janatin, nama di laporan "Ruma Kopiaksa") sudah masuk dan bisa dilihat/diunduh PDF di menu **Laporan Keuangan** (Owner/Admin/Finance). Bagi hasil sesuai laporan: Pengelola 90%, Ibu Prasetya Ida Suntari 5%, Ibu Oktantina Ratnasari 5%; sedekah 2,5% dari laba kotor; sewa Rp1.416.667 ke Dwi Suyoko. Outlet kedua (UHB) belum punya laporan. Menu laporan untuk mitra masih dikunci.

## Catatan teknis
- `supabase/migrations/0005_sampah_otomatis.sql` (hapus permanen sampah > 30 hari) belum terpasang; jalankan manual di SQL Editor.
- Login OTP memakai email Supabase. Ubah template *Magic Link* di Supabase → Authentication → Email Templates agar memuat `{{ .Token }}`. Email bawaan Supabase dibatasi beberapa email per jam; untuk produksi pasang SMTP sendiri.
- Default sementara: batas diskon kasir 10% (`perusahaan.batas_diskon_persen`), pendapatan ojol dicatat bruto sesuai harga menu ojol.

## Pertanyaan terbuka (dari PRD, perlu dijawab sebelum Tahap 3/6)
- Pendapatan ojol dicatat bruto atau neto? Isi baris "Pendapatan Lain-Lain"?
- Kiriman pusat dinilai harga beli pusat atau ada markup?
- Sewa tidak dihitung dalam BEP (default) — konfirmasi.
- Penandatangan laporan & tanda tangan digital?
- Jam 3 shift tiap outlet & toleransi terlambat?
- Batas diskon kasir tanpa PIN SPV?
