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

## Tampilan Tim Outlet Mitra (7 November 2026)

`/portal/karyawan` (hanya tampilan, tanpa migrasi): kartu ringkasan (anggota, bertugas sekarang, shift hari ini, foto profil), kartu karyawan dengan jabatan berwarna, shift & status absen hari ini (jam masuk/telat/pulang), shift berikutnya. No. WA dan alamat **tidak ikut terkirim** ke browser: tampil tersamar, ikon mata memanggil server action `bukaDataKaryawan` (`src/lib/mitra-karyawan-actions.ts`, tetap lewat RPC `karyawan_outlet_saya` dengan RLS Mitra), terbuka 10 detik lalu tertutup otomatis (`data-tertutup.tsx`). Jadwal Shift tetap komponen `MitraJadwal` (hanya lihat).

## Impor laporan PDF, hapus draft & desain jadwal (10 November 2026)

- **Impor laporan (PDF)** di Laporan Keuangan (Owner/Admin Pusat/Finance): `src/components/impor-laporan-pdf.tsx`. PDF format Ruma dibaca di browser dengan pdf.js (salinan tetap di `public/pdfjs/5.4.624/`, dimuat `webpackIgnore` karena bundel Next merusak modul pdf.js; path dikecualikan dari middleware). Parser murni `src/lib/laporan-pdf.ts` → grid → `parseLaporan` (sama dengan impor Excel) + tabel transfer versi PDF + angka total PDF untuk cek. Pratinjau bisa dikoreksi; disimpan lewat `imporLaporan` → **draft internal** (tidak terbit ke Mitra). Diverifikasi dengan 4 PDF Juni–September: semua angka cocok dengan laporan resmi di DB (laba bersih selisih Rp1 = pembulatan). `parseLaporan` kini juga membaca "Bagi Hasil a.n …" dan "Untuk Pengelola" tanpa persen (persen = sisa 100%).
- **Hapus draft**: RPC `hapus_laporan_internal(outlet, periode, versi)` (security definer, Owner/Admin Pusat/Finance, cek versi, isi draft disalin ke `log_aktivitas` sebelum dihapus). Laporan resmi `laporan_bulanan` tidak disentuh. Tombol di halaman laporan bulan berjalan (`proyeksi-form.tsx`).
- **Jadwal buka (Accounting)**: `laporan/proyeksi/jadwal-buka.tsx` — pilihan cepat, tanggal, tombol jam, pratinjau "dibuka … · N hari lagi", label status.
- **Kartu Mitra** `akses-laporan-mitra.tsx`: > 6 jam hanya tanggal + "N hari lagi/besok pagi"; ≤ 6 jam hitung mundur Jam·Menit·Detik per detik + progres; saat waktu tiba & disetujui halaman refresh otomatis, gembok terbuka (animasi `laporan-buka`). Aturan akses tidak berubah.
