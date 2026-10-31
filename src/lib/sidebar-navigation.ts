import type { MenuItem } from "./roles";

/** Kelompok hanya mengatur susunan menu yang sudah diberikan oleh peran. */
export const ADMIN_MENU_GROUPS = [
  {
    title: "Ringkasan",
    hrefs: ["/dashboard", "/dashboard-pos", "/stok-realtime"],
  },
  {
    title: "Outlet & Kemitraan",
    hrefs: [
      "/master/outlet",
      "/master/mitra",
      "/master/perjanjian",
      "/proyek",
      "/simulasi",
    ],
  },
  {
    title: "Karyawan & Kehadiran",
    hrefs: [
      "/master/karyawan",
      "/profil-karyawan",
      "/kasbon",
      "/jadwal",
      "/absensi",
      "/persetujuan",
      "/penggajian",
    ],
  },
  {
    title: "Menu & Produk",
    hrefs: [
      "/master/kategori_menu",
      "/master/menu",
      "/master/varian",
      "/master/resep",
      "/hpp-menu",
    ],
  },
  {
    title: "Gudang & Persediaan",
    hrefs: [
      "/master/bahan",
      "/gudang/stok",
      "/master/supplier",
      "/gudang/pembelian",
      "/gudang/kiriman",
      "/gudang/mutasi",
      "/persediaan",
      "/rumus-hpp",
      "/stok",
      "/gudang/opname",
      "/operasional/kiriman",
      "/gudang/outlet",
      "/gudang/dokumen-arsip",
      "/gudang/pengaturan-dokumen",
    ],
  },
  { title: "Titipan Produk", hrefs: ["/titipan", "/master/produsen_titipan"] },
  {
    title: "Keuangan & Laporan",
    hrefs: [
      "/catatan-harian",
      "/setoran",
      "/gudang/laba-rugi",
      "/master/biaya_outlet",
      "/laporan",
      "/laporan-pos",
      "/tutup-buku",
      "/skema-bagi-hasil",
      "/transfer",
      "/portal/bep",
    ],
  },
  {
    title: "Pengguna & Pengaturan",
    hrefs: [
      "/pengguna",
      "/pengaturan/pos",
      "/pengaturan/qris",
      "/pengaturan/maintenance",
      "/log",
    ],
  },
];
export function kelompokkanMenuAdmin(items: MenuItem[]) {
  const known = new Set(ADMIN_MENU_GROUPS.flatMap((g) => g.hrefs));
  const groups = ADMIN_MENU_GROUPS.map((g) => ({
    title: g.title,
    items: g.hrefs.flatMap((href) => items.filter((m) => m.href === href)),
  }));
  const rest = items.filter((m) => !known.has(m.href));
  if (rest.length) groups.push({ title: "Menu Lainnya", items: rest });
  return groups.filter((g) => g.items.length);
}
