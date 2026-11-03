# Laporan internal dan jadwal akses Mitra

Halaman `/laporan` menampilkan periode dari aktivitas POS, catatan manual, biaya, kiriman diterima, draft, laporan resmi, dan bulan berjalan. Tidak ada daftar bulan/tahun yang dikunci pada November. Buka **Periksa Internal** untuk perhitungan terbaru saat halaman dibuka; **Muat ulang data terbaru** meminta konfirmasi agar perubahan belum tersimpan tidak hilang tanpa pemberitahuan.

## Alur Accounting

- Otomatis: proyeksi operasional yang sudah ada tetap dipakai. Draft menyimpan isian serta baseline. Koreksi pendapatan, beban, pembelian, dan titipan diterapkan sebagai selisih atas data terbaru, bukan transaksi baru. Nilai persediaan akhir dan daftar karyawan yang diedit merupakan pengganti eksplisit.
- Manual/impor: angka menjadi pengganti laporan, tidak ditambahkan pada POS. Baris pendapatan, bagi hasil, serta transfer tetap bisa diedit. Impor Excel kini masuk draft internal, tidak langsung terbit.
- Karyawan berasal dari jadwal terbit/kehadiran outlet dalam bulan laporan; master aktif dipakai sebagai fallback bulan berjalan bila belum ada jadwal/absen. Edit hanya memengaruhi laporan.
- Simpan Internal menyimpan seluruh isian, sumber, alasan, jadwal WIB, dan snapshot preview. Konflik versi antar-tab ditolak. Preview tersimpan memakai format laporan yang sama dan menyediakan PDF/Excel berlabel Draft Internal. Tanda tangan gambar tidak ditampilkan pada draft PDF/preview.
- Persediaan awal mengambil bulan sebelumnya secara berurutan (draft internal bila ada, jika tidak versi resmi), bukan melompati Oktober yang belum diinput. Bila belum tersedia, tampil peringatan untuk verifikasi.
- Setujui Terbit ke Mitra menyimpan snapshot resmi secara atomik. Persetujuan wajib disertai jadwal. Perubahan draft selanjutnya tidak mengubah versi resmi; konfirmasi revisi dan persetujuan ulang diperlukan, termasuk perubahan jadwal versi resmi.

## Akses Mitra

Metadata periode terpisah dari angka laporan. Periode tetap muncul dalam kondisi terkunci, dengan tanggal/jam WIB serta hitung mundur hari/jam/menit. Tanpa jadwal ada pesan persiapan; lewat jadwal tanpa persetujuan ada pesan pemeriksaan akhir. Mitra baru bisa membaca tabel laporan resmi setelah `mitra_disetujui` dan `mitra_buka_at <= now()`. Akses detail, PDF/Excel dan agregat yang membaca laporan ikut dilindungi RLS, bukan hanya tombol UI. Empat laporan lama tetap disetujui dan tersedia.

Aset: `public/mascot/laporan-terkunci.webp` dan `laporan-terbuka.webp`, WebP RGBA 384 px. Dibuat dengan image_gen bawaan dari referensi maskot login. Prompt: karakter Matoer oranye-putih, blangkon cokelat-emas dan jaket gelap, setengah badan di lingkaran kuning, memegang gembok tertutup/terbuka, 3D lembut, tanpa teks, latar transparan.

## Verifikasi

Unit test menguji delta terhadap transaksi baru, simpan ulang tanpa pelipatan, manual/impor sebagai pengganti, edit staf/opname, WIB lintas tahun, serta syarat waktu + persetujuan. Uji transaksi database yang di-ROLLBACK memeriksa simpan/publikasi, konflik versi, draft privat, metadata terkunci, akses setelah jadwal, penolakan akses staf untuk Mitra, dan akses laporan lama. Tidak ada laporan contoh atau publikasi sungguhan dibuat dalam uji tersebut.

Pratinjau lokal memakai komponen asli dengan data contoh; route uji dan pengecualian middleware dihapus sebelum deploy. Data Oktober belum diimpor karena file belum diberikan. Tidak ada laporan November diterbitkan ke Mitra otomatis oleh perubahan ini.

Hasil akhir: 367 tes pada 59 berkas lulus; TypeScript, ESLint quiet, dan build produksi lulus. PDF contoh tiga halaman A4 dirender dan diperiksa; Excel dibaca ulang untuk memverifikasi nilai serta penanda internal. Peringatan advisor global yang sudah ada berada di luar perubahan ini; fungsi metadata/staf baru mengecek auth dan tidak dapat dieksekusi anon.
