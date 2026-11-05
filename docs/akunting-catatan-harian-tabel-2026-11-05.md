# Catatan Harian model Excel & perbaikan akunting (5 November 2026)

## Ringkas
- **Tabel (Excel)** di `/catatan-harian` (default; pilihan tersimpan per browser): baris tanggal, kolom kanal penjualan + pengeluaran per kategori + setoran/selisih. Ketik angka + Enter = disimpan sebagai **penyesuaian** (`penjualan_manual` jenis koreksi, delta) — angka POS tidak pernah ditimpa. Del / ↺ = kembali ke POS (arsip penyesuaian sel). Ctrl+V tempel blok dari Excel. Tampilan **Per hari** (lama) tetap ada.
- **Asal uang** (`rincian_harian`): daftar transaksi hari operasional; ⚠️ bila kanal ≠ metode bayar; akunting bisa koreksi kanal/metode (`koreksi_transaksi`).
- **Riwayat perbaikan** (`riwayat_perbaikan_harian`): koreksi/hapus/void transaksi, perubahan pengeluaran (termasuk kas final), input manual — siapa, kapan, dari → ke, alasan.
- **Catatan Harian tetap per KANAL** (Normal dipecah tunai/non tunai) — JANGAN diganti per metode: 2 Nov kasir memilih metode QRIS untuk pesanan online (kanal benar), sehingga per metode merusak rekonsiliasi BNI 744.000. Field `janggal` = jumlah transaksi kanal≠metode per hari.
- **Pengeluaran kas final**: trigger `jaga_biaya_tutup` mengizinkan perubahan hanya lewat RPC `koreksi_biaya_final` (flag `matur.biaya_final`). Kategori/keterangan: siapa pun dengan akses outlet (POS & akunting). Nominal/sumber/hapus: Owner/Admin Pusat/Finance + alasan (`PERLU_ALASAN`), kas seharusnya shift digeser (`koreksi_internal.geser_kas`). Server action `ubahPengeluaran/hapusPengeluaran` otomatis jatuh ke RPC ini; klien memakai `denganAlasan`.
- **Rumus HPP**: label komponen titipan bisa diedit (`rumus_hpp.label_titipan`, default "Tagihan snack & cheesecake").
- Data: #27 (GrabFood→Normal) & #30 (Normal→GrabFood) Kominot 4 Nov dikoreksi (`koreksi_data_akunting`). Ruma App 4 Nov (3 trx, Rp540.000) belum diubah — menunggu cek akunting.

Migrasi: `20261105090000_akunting_perbaikan_harian.sql` (dijalankan via SQL Editor), `20261105231111_rekap_harian_kanal_janggal.sql`.

## Atur kolom (5–6 November)
- Susunan kolom bersama akunting di `perusahaan.tabel_harian` (`{urutan, sembunyi, tampil, lebar}`), RPC `atur_tabel_harian` (Owner/Admin Pusat/Finance). Klien menyimpan otomatis (debounce 600 ms) setiap kolom digeser/disembunyikan/dilebarkan.
- Header: seret untuk pindah, ◀ ▶ 👁 saat hover, tarik tepi kanan untuk lebar, klik dua kali judul pengeluaran = ganti nama (`ganti_nama_kategori_biaya`). Tombol **＋ Kolom** / **⚙ Atur kolom**: tampilkan kolom tersembunyi/kosong, buat kategori baru (`tambah_kategori_biaya`, grup hpp/beban/lain, langsung tersedia di POS & Rumus HPP), ↺ susunan bawaan.
- Kolom penjualan & total tidak bisa diganti nama/dihapus; kategori berdata tidak dihapus, cukup disembunyikan.
- **⬇ Excel (tabel ini)** mengekspor kolom sesuai susunan yang tampil; **Excel (format Ruma)** tetap format sheet lama.
- File `"use server"` hanya boleh mengekspor fungsi async (konstanta di-ekspor membuat aksi gagal dipanggil dari klien).
