# HRD operasional: kelola menu & laporan omzet — 2 November 2026

Atas persetujuan pemilik, HRD (peran operasional) mendapat:
- **Menu & Harga POS** (`/master/menu`, termasuk ubah harga & hapus = arsip), **Kategori Menu**, **Additional & Varian**, editor **Kemasan/Gula/Extra** (`/menu-varian/[id]`), **HPP Menu** (`/hpp-menu`, edit resep).
- **Laporan POS & Stok** lengkap (semua tab, termasuk lingkup gudang/semua outlet).
- Kartu **Omzet hari ini** (semua outlet, dibanding kemarin) di Beranda HRD, live.

DB (migrasi `20261102012659_hrd_kelola_menu_laporan.sql`, hanya menambah izin): policy `kelola_hrd` pada `menu`, `kategori_menu`, `varian`, `resep`, `hpp_menu`; unggah foto bucket `menu`; `menu_internal.atur_varian`/`atur_resep` dan cek semua-outlet `laporan_operasional` ditambah `hrd`.
App: `roles.ts` (menu HRD), `master.ts` editors, `PENGELOLA_MENU`, `hpp-actions`, halaman `hpp-menu`, `PERAN_LAPORAN`/`PERAN_GUDANG`.
