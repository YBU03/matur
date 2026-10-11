# Panduan Pemantauan Pembangunan Outlet

Alamat aplikasi: https://matur-ybu.vercel.app

## 1. Admin Pusat / Owner — menyiapkan proyek
1. Login → pilih peran **Admin Pusat**.
2. **Pengguna & Akses** (peran Owner): buat akun **Mitra** (email) dan **PIC / Kontraktor** (email), pilih outlet yang sesuai.
3. **Outlet**: pastikan outlet baru sudah ada (status *pembangunan*).
4. **Proyek Pembangunan → + Kelola Proyek → + Tambah**: isi nama, outlet, estimasi budget, tanggal mulai, target buka.
5. Buka proyek → **Kelola Pekerjaan & PIC**: tambah pekerjaan (mis. Renovasi, Instalasi listrik, Branding), pilih PIC, isi **bobot** (pekerjaan besar diberi bobot lebih besar).
6. **Kelola RAB**: isi kebutuhan (mesin espresso, grinder, furnitur, …) dengan total estimasi; isi realisasi dan ubah status *rencana → dibeli → terpasang* saat berjalan.

## 2. PIC / Kontraktor — melapor progres
1. Login dengan email → menu **Progres Pekerjaan** → buka proyek.
2. Pada pekerjaan miliknya tekan **Lapor progres**: geser persentase, ambil foto, tulis keterangan → **Kirim**.
3. Laporan menunggu persetujuan Admin Pusat.

## 3. Admin Pusat — menyetujui
Di halaman proyek muncul kotak **Menunggu persetujuan**. **Setujui** → progres pekerjaan diperbarui dan foto tampil ke mitra. **Tolak** → tidak tampil.
Foto yang diunggah Admin Pusat langsung disetujui.

## 4. Mitra — memantau
Login → **Progres Pembangunan** (juga tampil di Dashboard): progres total, budget vs realisasi, sisa budget, hitung mundur grand opening, daftar pekerjaan + PIC, galeri foto, RAB, dan timeline.
Menu lain (Laporan Bulanan, Progres BEP) masih terkunci 🔒 dan dibuka bertahap.

## Rumus
- Progres total = Σ(bobot × progres) ÷ Σ bobot.
- Realisasi = jumlah kolom *Total Realisasi* RAB. Sisa budget = estimasi budget − realisasi.

## 5. Rincian Keperluan (import/export)
Buka proyek → **Lihat rincian →** (atau tombol *Rincian Keperluan* untuk admin).
- **Import Excel**: pilih file `.xlsx`. Bisa langsung memakai format *Daftar Material dan Harga* (sheet material per bagian, interior, tukang) maupun file hasil Export Matur. Muncul pratinjau total per kelompok + peringatan bila total tertulis di file berbeda dengan penjumlahan item. Pilih *tambahkan* atau *ganti semua* (data lama masuk tempat sampah).
- **Export Excel / PDF**: unduh rincian lengkap dengan subtotal per kelompok dan grand total. File Excel hasil export bisa diedit lalu di-import kembali.
- **+ Tambah / Ubah Item**: isi kelompok, bagian, nama barang, spesifikasi, jumlah, satuan, harga satuan (total dihitung otomatis bila dikosongkan), realisasi, status.
