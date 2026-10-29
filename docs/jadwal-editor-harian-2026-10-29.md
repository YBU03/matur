# Editor jadwal harian — 29 Oktober 2026

Disetujui setelah pemeriksaan dan overview. Pengelola tetap Owner/HRD dan SPV sesuai outlet; Aturan hanya Owner/HRD. Admin Pusat tetap menggunakan rekap jadwal yang hanya lihat, sesuai pembagian kewenangan sebelumnya.

## Pemakaian

Buka **Jadwal Shift**. Gunakan pemilih tanggal dan **Kelola tanggal**, atau ketuk judul tanggal pada kalender. Panel menampilkan nama lengkap, shift/jam, status draft/terbit, tombol Ubah, dan tambah jadwal/libur/izin/sakit. Edit dapat memindahkan tanggal, mengganti orang/shift, atau memakai jam khusus penugasan itu. Hapus/libur dari editor berlaku untuk jadwal asal (tanggal pada judul), bukan perubahan yang belum disimpan.

Tab Kalender, Shift, Staf, Aturan berpindah langsung, URL tetap mengikuti tab, dan dapat kembali melalui navigasi browser. Popup menggunakan portal, batas tinggi layar, gulir, fokus keyboard, tombol tutup dan Escape. Form tidak ditutup sebelum sukses; pesan gagal tampil di dalam popup. Data shift/staf/aturan/jadwal gagal dimuat menghasilkan kesalahan yang jelas, bukan daftar kosong seolah tidak ada data. Perubahan shift memeriksa jumlah baris yang benar-benar tersimpan.

## Relasi data

- RPC public `kelola_jadwal_harian` (invoker) mengarah ke fungsi privat berizin di `jadwal_internal`. Izin berasal dari tabel penugasan/pengguna aktif, bukan metadata pengguna. Aksi edit/hapus memakai versi jadwal; akses lintas outlet ditolak. Penggantian/pemindahan libur dilakukan satu transaksi, termasuk pembatalan libur lama dan pencatatan libur tujuan secara eksplisit.
- Jam khusus disimpan sebagai `shift_outlet` anak (`induk_shift_id`, `khusus_jadwal_id`) yang **tidak aktif sebagai template**. Satu definisi anak untuk satu penugasan. FK `jadwal_shift.shift_id` tetap dipakai seluruh pembaca (absensi, POS, pengingat, rekap/gaji, jadwal karyawan), sehingga pembaca lama langsung memperoleh jam yang benar, termasuk lewat tengah malam. Template dan tanggal lain tidak berubah. Jika penugasan dihapus, definisi jam tetap berarsip sebagai anak, bukan menjadi template.
- Kalender mengelompokkan anak ke induknya dan memberi label jam khusus pada nama staf. Daftar template tidak menampilkan anak. Pemuat shift dipaginasi agar definisi khusus tidak membuat data diam-diam terpotong pada batas API.
- Susun otomatis menghitung jadwal terbit khusus sebagai pengisi kuota shift induk, tetapi interval benturan memakai jam khusus. Definisi anak tidak dibuat otomatis sebagai shift baru. Menyusun ulang draft meminta konfirmasi karena perubahan manual draft akan diganti. Jadwal terbit dipertahankan.
- Trigger melindungi perubahan/hapus penugasan yang sudah memiliki absensi, termasuk jalur lama, sehingga FK absensi tidak terlepas. Mengubah jam template yang sudah dipakai absensi juga ditolak: buat template baru untuk jam baru atau gunakan jam khusus pada penugasan yang belum absen. Koreksi kehadiran tetap melalui HRD.
- Clock In/Out dan edit jadwal mengambil kunci outlet yang sama sebelum memilih jam. Tidak mengubah aturan foto/GPS, perhitungan telat, tarif, atau rumus gaji. Tidak mengaktifkan switch/pengunci POS.

## Verifikasi

Pengujian PGlite mencakup tanggal/orang/jam khusus malam, versi usang, libur atomik beserta rollback kegagalan, pengganti dengan jam khusus, perlindungan absensi/templat, batas peran/outlet, serta perhitungan lembur melalui FK jam khusus. Tes scheduler memeriksa kuota induk dan benturan jam nyata. `supabase/tests/jadwal_editor_harian.sql` menjalankan akun authenticated dengan fixture terisolasi, diakhiri ROLLBACK.

Browser lokal dengan data contoh berhasil mengklik Shift, Staf, Aturan, Kalender dan membuka panel tanggal. Pengambilan screenshot/form lanjutan mengalami timeout pada alat browser; tidak diklaim telah diuji di perangkat fisik. Halaman fixture, rewrite dan pengecualian middleware dihapus sebelum build/deploy.
