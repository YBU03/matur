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
