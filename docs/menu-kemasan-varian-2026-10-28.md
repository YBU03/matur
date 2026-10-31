# Menu: Kemasan, Gula & Extra — 28 Oktober 2026

Disetujui pemilik ("kita kerjakan yang varian additional dulu"), memakai opsi A.

- Editor per menu di `/menu-varian/[id]` (tombol **🧋 Varian & Kemasan** di Data Master → Menu). Peran: Owner, Admin Pusat, Admin Gudang.
- **Kemasan** (Cup/Hot/Can/…) = anak menu (`menu.induk_id`, `menu.kemasan`) dengan harga dine-in & ojol sendiri, resep & HPP sendiri. Nama otomatis `Menu (Kemasan)`. Kemasan baru menyalin resep menu induk sebagai awal. Hapus kemasan = soft delete (riwayat penjualan tetap).
- **Gula/Extra/Suhu/Ukuran** = tabel `varian` lama, disimpan di menu induk dan disinkronkan ke semua kemasan (id stabil per grup+nama agar resep per varian tidak putus).
- Mesin transaksi, katalog izin POS dan offline tidak diubah: anak menu adalah menu biasa. POS menampilkan satu kartu per menu induk ("mulai Rp …"), kasir wajib memilih kemasan lalu Gula/Extra.
- Ubah nama/kategori/foto/urutan/hapus/pulihkan menu induk ikut ke kemasan (trigger `sinkron_kemasan`). Menu induk nonaktif = semua kemasan tersembunyi di POS.
- RPC `atur_varian_menu(p jsonb)` → `menu_internal.atur_varian` (security definer, validasi, log_aktivitas). Halaman lama `/master/varian` tetap ada dengan petunjuk ke editor baru.

## 31 Oktober — HPP Menu live & editor resep
- `/hpp-menu` menghitung HPP dari resep dasar POS × `bahan.harga_pokok` saat ini (sama dengan `buat_transaksi`); titipan = harga titip. Kemasan tampil per baris dengan harga jual dine-in/ojol & margin; resep induk = template kemasan baru. Data file HPP RUMA (`hpp_menu`) tetap disimpan sebagai referensi dan tidak dipakai POS.
- Editor resep (modal `EditorResep`) di HPP Menu dan Varian & Kemasan → RPC `atur_resep_menu` (`menu_internal.atur_resep`): mengganti resep dasar (varian_id null) satu menu, resep per varian tidak disentuh, titipan ditolak, tercatat di log.

