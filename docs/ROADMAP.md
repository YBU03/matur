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
| 5 | Tutup shift & setoran kas, absensi & jadwal, izin/cuti · sisa POS: mode offline (PWA/IndexedDB), split payment/bill, void & diskon dengan PIN SPV, printer thermal langsung | SFT, ABS, POS-03/04/08 | 🟡 ±30% (kas & tutup shift sudah) |
| 6 | Gudang & stok (pembelian, kiriman, penerimaan, potong stok via resep, opname, waste, transfer) | GDG-01–09 | 🟡 ±65% (kiriman, terima, potong stok resep, opname sudah) |
| 7 | Dashboard pusat (grafik) + Akunting & **laporan mitra format resmi** (PDF/Excel, tutup buku, transfer) | DSB, AKT | 🟡 ±85% (dashboard, laporan PDF visual, proyeksi, catatan harian, tutup buku, transfer sudah) |
| 8 | Penggajian & slip gaji | GJI-01–06 | ⬜ 0% |
| 9 | Portal mitra (laporan bulanan, BEP), mode simulasi | MTR-02–06, SIM | 🟡 ±70% (laporan bulanan & BEP mitra sudah; halaman mode simulasi belum) |

Uji penerimaan laporan: angka periode **Agustus 2026 Ruma Kopiaksa** harus sama
persis dengan laporan manual (laba bersih Rp32.181.189 ✅; bagi hasil mengikuti laporan terbit: 2 × 5% = Rp3.218.118, bukan angka contoh PRD Rp17.699.654).

## Pembaruan
- Nama aplikasi menjadi **Matoer** (domain "matur" sudah dipakai pihak lain).
- Dashboard visual (DSB-01..05): pilih cabang + periode, kartu KPI dengan perbandingan periode sebelumnya, tren omzet per outlet, perbandingan cabang, komposisi kanal, menu terlaris & kurang laku, heatmap jam ramai, progres pembangunan; mitra/PIC melihat grafik progres pekerjaan dan estimasi vs realisasi.
- Data simulasi (mode `simulasi`, ±75 hari, 2 outlet) untuk mencoba dashboard; aktifkan dengan centang "Data simulasi" (Owner/Admin Pusat). Tidak pernah tampil di POS, data master, maupun laporan asli.

- Laporan keuangan resmi Juni–September 2026 outlet pertama (Ruma Kopi Usman Janatin, nama di laporan "Ruma Kopiaksa") sudah masuk dan bisa dilihat/diunduh PDF di menu **Laporan Keuangan** (Owner/Admin/Finance). Bagi hasil sesuai laporan: Pengelola 90%, Ibu Prasetya Ida Suntari 5%, Ibu Oktantina Ratnasari 5%; sedekah 2,5% dari laba kotor; sewa Rp1.416.667 ke Dwi Suyoko. Outlet kedua (UHB) belum punya laporan. Menu laporan untuk mitra sudah dibuka (13 Okt).

## Daftar tunda (dikerjakan nanti)
- ✅ (13 Okt) **Alur akunting format Ruma**: pengeluaran harian di kasir (laci/pusat) + tutup shift cocok kas, Catatan Harian (+ ekspor Excel format Ruma), opname outlet, cocok ojol → pendapatan lain-lain, sewa rata per bulan ke rekening mitra, laporan visual web & PDF. Lanjutan: foto nota pengeluaran, potong stok otomatis dari resep, penggajian.
- ✅ (13 Okt) **Akunting otomatis** (no. 5): menu Biaya Operasional (input harian per outlet, SPV/Finance) + halaman *Proyeksi laporan otomatis* (penjualan POS per kanal/metode, diskon, pembelian = kiriman gudang diterima, beban = biaya harian, sedekah & bagi hasil dari skema) → tombol Terbitkan menjadi laporan resmi. Lanjutan: potong stok otomatis dari resep (HPP pemakaian), opname outlet, gaji dari penggajian.
- ✅ (13 Okt) **HRD & Admin Gudang mengelola akun kasir/barista** (no. 9) + penanda "karyawan outlet" saat daftar.
- ✅ (13 Okt) **Kiriman gudang → outlet** (no. 13): draft → kirim (stok gudang berkurang) → diterima outlet (stok outlet bertambah, selisih kembali ke gudang), Surat Jalan & Invoice PDF, riwayat mutasi stok.
- **Buka/tutup kunci laporan** (admin pusat & akunting): laporan bulan tertentu bisa dikunci agar tidak bisa diubah/terlihat mitra sebelum final, lalu dibuka lagi — *antrean, belum digarap*.
- **Pesanan draft / bayar nanti** khusus bos yang datang ke kantor (no. 8) — *jangan digarap dulu*.
- **OTP email saat daftar + Lupa password.** Kode 6 digit ke email pendaftar sebelum masuk antrean ACC admin; lupa password lewat kode email. Akun Brevo (paket Free, ±300 email/hari) sudah dibuat. Sisa langkah:
  1. Tambah & verifikasi sender di Brevo (sementara Gmail; bisa masuk spam).
  2. Isi SMTP di Supabase → Authentication → SMTP: host `smtp-relay.brevo.com`, port `587`, username = login SMTP Brevo (`…@smtp-brevo.com`), password = SMTP key. SMTP key jangan dibagikan lewat chat.
  3. Naikkan rate limit email Supabase (±30–60/jam), pasang template email berbahasa Indonesia berisi `{{ .Token }}`.
  4. Bangun alur OTP daftar & Lupa password di aplikasi.
- **Domain sendiri sebelum launching November** (mis. `matoer.id` / `matoer.com`): pengirim email resmi (`noreply@…`, tidak masuk spam) dan alamat aplikasi (`app.…` menggantikan `matoer.vercel.app`).
- Cicilan kecil lain: badge notifikasi menu Proyek, tombol Bagikan ke WhatsApp, riwayat aktivitas proyek, jawaban pertanyaan terbuka PRD, hapus otomatis tempat sampah >30 hari, form input laporan bulanan memakai skema bagi hasil.

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
