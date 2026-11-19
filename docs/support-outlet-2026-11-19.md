# Support Outlet — 19 November 2026

Atas persetujuan pemilik, Mitra mendapat menu Support Outlet di `/portal/support-outlet`. Lima kontak awal: HRD (Deva/Fajri), HRD Operasional (Zahro), Warehouse (Isma), Akunting (Faika), Marketing (Ratna/Dian/Yoga). Nomor dipertahankan sesuai instruksi pemilik; nomor kartu dan tombol Chat WhatsApp menuju wa.me, tombol Telepon menuju tel:+62.

Owner/Admin Pusat mengelola lewat `/pengaturan/support-outlet` (Kelola Support Outlet dalam Pengguna & Pengaturan): tambah/edit, urutan, aktif/nonaktif, hapus dengan konfirmasi, pratinjau kartu Mitra. Hapus berupa arsip deleted_at; riwayat ada di Log Aktivitas. Kontak aktif dipakai bersama seluruh Mitra. Perubahan tampil ketika halaman Mitra dimuat ulang; tidak menambah polling berkala.

## Data dan akses

- Tabel `support_outlet`, migration `20261119042529_support_outlet.sql`.
- Nomor disimpan sebagai digit 62..., input 08.../+62... dinormalisasi dan divalidasi di server. Constraint database menolak nomor di luar pola yang diizinkan.
- RLS: Owner/Admin Pusat aktif dapat menambah/mengubah; Mitra aktif hanya membaca kontak aktif yang belum dihapus; anon dan peran lain tidak mendapat akses. Tidak ada grant DELETE; UPDATE hanya kolom editable. Route dan server actions juga memeriksa peran aktif.
- Trigger timestamp dan optimistic updated_at melindungi dari penyimpanan/hapus versi lama. Trigger audit memakai catat_log yang tersedia, tanpa fungsi security definer baru.
- Lima seed disimpan pada migrasi; UUID dihasilkan database, tidak hardcode ID pengguna/outlet.

## Verifikasi

Tes tujuan tautan WhatsApp/telepon, penolakan input berbahaya dan pemisahan menu peran. PGlite menguji RLS dan CRUD: Admin tambah/edit/nonaktif/aktif/hapus, Mitra read-only, akun nonaktif/peran lain/anon ditolak, stale update nol baris, nomor invalid ditolak dan audit tercatat.

SQL database terpasang juga diuji dengan role authenticated untuk Admin dan Mitra; seluruh data uji di-ROLLBACK. Lima kontak aktif cocok. Security advisor tidak menambah temuan. TypeScript dan ESLint diperiksa; build Vercel menjadi pemeriksaan produksi. Pengujian visual langsung pada browser/HP belum dilakukan.
