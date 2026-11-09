# Draft pekerjaan tertunda (9 November 2026)

Status: **DRAFT — belum dikerjakan, menunggu "gas" pemilik per butir.** Tidak ada perubahan kode/database untuk butir di bawah.

## 1. Akun karyawan, PIN & password (temuan 7 Nov, sudah diuji ROLLBACK)
- **Hapus akun lalu tambah akun gagal**: `hapus_pengguna` mengarsipkan akun (status `dihapus`) tetapi `karyawan.pengguna_id` tetap menunjuk akun lama → `buatAkunKaryawan` menolak "Karyawan ini sudah punya akun", ganti PIN gagal "Hanya PIN staf outlet" (penugasan sudah dihapus). Data terdampak: *Barista Satu* (akun dihapus), *Kasir Satu* (akun nonaktif).
  - Usulan: lepas tautan karyawan saat arsip; UI Master Karyawan tampilkan "Akun dihapus — Buat akun baru"; bereskan dua data di atas. Riwayat absensi/gaji tetap di akun lama.
- **HRD tidak bisa ganti password SPV**: `atur_password` → `staf_outlet()` hanya kasir/barista, padahal HRD boleh membuat akun SPV (`buat_pengguna`). Usulan: HRD boleh reset password/PIN SPV; peran kantor tetap Owner.
- **Ganti PIN akun kode staf (`@pin.matur.id`) di menu Pengguna** hanya mengubah PIN shift POS (`atur_pin` → `atur_pos_pin`), bukan PIN login, padahal pesannya "PIN diperbarui". Usulan: ubah PIN login + PIN shift sekaligus, pesan diperjelas.
- Pesan error dibuat ramah (bukan teks teknis).
- `/kasir/riwayat` crash saat sesi habis (`getSession()!`) → redirect login.

## 2. Outlet Demo dinonaktifkan
- Switch saat ini (`tampil_dashboard_pos`) hanya menyembunyikan dari agregat Dashboard POS (desain 2 Nov). Demo masih muncul di ±30 halaman pemilih outlet, stok, gudang, titipan, catatan harian, jadwal, dll.
- Usulan: status outlet **Nonaktif** (enum `status_outlet` sudah punya `tutup`) → hilang dari seluruh admin, tetap di menu Outlet & Laporan/Riwayat (checkbox "sertakan outlet nonaktif"); data tidak dihapus.
- Pertanyaan terbuka: login POS outlet nonaktif ditolak? (usulan: ya). Data latihan hanya disembunyikan (usulan) atau dihapus?
- **Temuan perlu dicek**: akun "Tablet Outlet Demo (uji coba)" tercatat `masuk_pos_outlet` ke **Ruma Kopi Kominot** pada 7 Nov 13.48 WIB.

## 3. Pop-up terima kasih selesai shift (POS)
- Muncul setelah "Salin laporan" saat tutup kas/shift; maskot, judul ("Matur nuwun, {Nama}! 🙏"), ringkasan "Laporan tersalin ✓ · {N} transaksi", satu kalimat penyemangat acak, tombol "Sampai jumpa besok 👋", tutup otomatis ±8 detik.
- Daftar kalimat (draft): setiap cangkir membuat hari seseorang lebih baik; capeknya jadi cerita baik, istirahat cukup; pelanggan pulang tersenyum karena kamu; besok kita seduh semangat baru; terima kasih menjaga rasa & senyum Ruma Kopi; pulang hati-hati, salam untuk keluarga. Opsional: kalimat shift malam & hari ramai.
- Perlu keputusan: tampilkan omzet atau hanya jumlah transaksi (usulan: transaksi saja); bahasa Jawa ringan vs Indonesia penuh; pakai kalimat malam/hari ramai.

## 4. Grafik pekerjaan Dashboard Mitra
- "Progres per pekerjaan" (`dashboard/projects.tsx`): nama pekerjaan panjang saling tumpuk; pekerjaan 0% tidak terlihat. Usulan: label dipotong rapi + tooltip, tampilkan "0%". Hanya tampilan.
- Target buka proyek UHB belum diisi (hitung mundur grand opening tidak tampil) — isi lewat menu Proyek.

## 5. Opsional lain
- Badge jumlah antrean di tab POS "Antrean".
- Harmonisasi tampilan halaman POS Riwayat/Kas/Stok/Antrean & popup struk.
- Foto kartu menu POS: pilihan rasio (16:10 sekarang / kotak / 4:3).
- Catat pembukaan No. WA/alamat karyawan oleh Mitra (audit log).
- Arsipkan hasil uji ASPI 9 Nov ke tab "10 Pengujian" SNAP Sandbox.

## Selesai 9 Nov (bukan draft)
Uji devsite ASPI 10/10: Signature Access Token, Signature Service, B2B Normal (2007300)/Abnormal (4017300), Generate QR Normal (2004700, merchant `merch00001`)/Abnormal (4014700), Query Normal (2005100)/Abnormal (4015100), Payment Notification Normal (2005200)/Abnormal (4015200). CORS sandbox untuk Client Simulator ASPI sudah live (`274ab84`). Lanjut: pengajuan evaluasi ASPI → surat rekomendasi → sandbox BNI.
