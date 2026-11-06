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

## POS pengeluaran & setoran (6 November)
- POS Kas & Pengeluaran: tab **Hari ini** / **7 hari terakhir** (hari operasional, `tglOperasional`). Pengeluaran yang kas shift-nya ditutup bertanda 🔒: kategori & keterangan bisa diperbaiki siapa pun di outlet (lewat `koreksi_biaya_final`), nominal/sumber dikunci di form (`FormPengeluaran kunciNominal`), tombol hapus disembunyikan.
- `catat_pengeluaran_pos` & `tempel_sesi_biaya` memakai `tgl_op(now())` (catatan 00.00–03.00 masuk hari shift berjalan).
- `rekap_setoran`: pengeluaran laci yang terikat sesi kas dihitung pada `greatest(tanggal, tgl_op(created_at))` — pengeluaran yang ditulis mundur ikut hari uang keluar dari laci, sehingga "harus disetor" = kas shift (2–5 Nov Kominot cocok). Pengeluaran pusat & impor tetap per tanggal catatan.

## Rincian per metode bayar mulai 5 Nov (revisi akunting 6 November)
- `rekap_harian`: mulai hari operasional **2026-11-05** kolom uang = **metode bayar** (sama Penjualan POS, setoran, BNI). Kanal = asal pesanan. **Tumbler = wadah**: uangnya masuk tunai/QRIS; info `tumbler_n/tumbler_nilai/tumbler_tunai/tumbler_nontunai` tampil sebagai kolom info 🥤 (tidak ikut total) & kartu "Pelanggan bawa tumbler". 1–4 Nov tetap per kanal (sudah direkonsiliasi). Jangan ubah tanggal batas tanpa diskusi.
- Aturan klien sama: `kolomBayar/janggal/RINCIAN_METODE_MULAI` di `src/lib/harian.ts`, dites di `src/lib/__tests__/rincian-harian-metode.test.ts`.
- POS tidak diubah (permintaan pemilik: jangan menyulitkan transaksi).
- **Barang titipan - Barang titipan & isi menu: migrasi `20261106140000_barang_titipan_isi_menu.sql` (lihat file). isi menu** (aktif 6 Nov): tabel `barang_titipan` (pcs/gram, harga/satuan, kelompok dessert/snack) & `isi_titipan` (isi per porsi). `menu.harga_titip` otomatis = Σ isi × harga (`matur_internal.sinkron_harga_titip`) sehingga mesin POS tidak berubah. Rekap `rekap_titipan_barang` (terjual = porsi × isi, termasuk produk_keluar, beserta asal per menu). `titipan_masuk.barang_id` untuk setoran/retur/rusak per barang; `menu_id` lama tetap didukung. RPC: `simpan_barang_titipan`, `hapus_barang_titipan` (nonaktif bila sudah ada riwayat), `simpan_isi_titipan`. Halaman `/titipan` jatuh ke tampilan per menu bila tabel barang kosong/tidak ada.

## Diskon (6 November)
- Mulai 5 Nov kolom uang Catatan Harian = **nominal pembayaran per metode (sesudah diskon)**, persis Penjualan POS. `rekap_harian.diskon` = 0 untuk tanggal ≥ 5 Nov agar total/laporan tidak memotong diskon dua kali; nilai diskon ada di `diskon_info` (tampil "info …" di kolom Discount & kartu ringkasan). Sebelum 5 Nov tetap bruto + kolom diskon.
- Konsekuensi: Laporan bulanan/ekspor Ruma menampilkan Discount 0 untuk ≥ 5 Nov (pendapatan sudah bersih). Total penjualan tidak berubah.
