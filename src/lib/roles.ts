// Definisi peran (PRD: Pengguna & Peran) dan menu dashboard tiap peran.

export type Role =
  | "owner"
  | "manajer_area"
  | "finance"
  | "hrd"
  | "admin_pusat"
  | "admin_gudang"
  | "spv"
  | "kasir"
  | "barista"
  | "mitra"
  | "pic"
  /** hanya memantau omzet & penjualan POS (tanpa HPP, laba, stok, gaji) */
  | "pemantau_pos"
  /** akun tersembunyi milik tablet POS outlet (dibuat saat pemasangan tablet) */
  | "tablet";

export type Mascot = "admin" | "akunting" | "gudang" | "kasir" | "mitra";

export type MenuItem = { href: string; label: string; stage: number };

type RoleDef = {
  label: string;
  mascot: Mascot;
  /** warna aksen sesuai ilustrasi maskot */
  accent: string;
  /** login: password / pin / otp (PRD tabel peran) */
  login: "password" | "password_otp" | "pin" | "otp";
  /** peran pusat melihat semua outlet; selain itu terikat outlet */
  allOutlets: boolean;
  /** boleh tanpa outlet (= semua outlet) atau satu outlet tertentu */
  outletOpsional?: boolean;
  menu: MenuItem[];
};

/** tahap pengembangan yang sudah selesai */
export const CURRENT_STAGE = 5;

/** satu-satunya halaman penjualan peran Tamu Matur */
export const PANTAU_POS = "/pantau-pos";

const dash: MenuItem = { href: "/dashboard", label: "Dashboard", stage: 1 };

export const ROLES: Record<Role, RoleDef> = {
  owner: {
    label: "Owner / Super Admin",
    mascot: "admin",
    accent: "bg-violet-600",
    login: "password_otp",
    allOutlets: true,
    menu: [
      dash,
      { href: "/dashboard-pos", label: "Dashboard POS", stage: 4 },
      { href: "/stok-realtime", label: "Stok Real-time", stage: 4 },
      { href: "/master/outlet", label: "Outlet", stage: 2 },
      { href: "/master/mitra", label: "Mitra", stage: 2 },
      { href: "/master/perjanjian", label: "Perjanjian Mitra", stage: 2 },
      { href: "/proyek", label: "Proyek Pembangunan", stage: 4 },
      { href: "/master/karyawan", label: "Karyawan", stage: 2 },
      { href: "/jadwal", label: "Jadwal Shift", stage: 5 },
      { href: "/absensi", label: "Rekap Absensi", stage: 5 },
      { href: "/persetujuan", label: "Persetujuan Izin & Tukar", stage: 5 },
      { href: "/penggajian", label: "Penggajian & Slip Gaji", stage: 5 },
      { href: "/master/menu", label: "Menu", stage: 2 },
      { href: "/gudang/stok", label: "Stok Gudang", stage: 4 },
      { href: "/gudang/kiriman", label: "Kiriman Bahan", stage: 4 },
      { href: "/persediaan", label: "Persediaan & HPP", stage: 4 },
      { href: "/rumus-hpp", label: "Rumus HPP", stage: 4 },
      { href: "/titipan", label: "Titipan Produk", stage: 4 },
      { href: "/master/produsen_titipan", label: "Produsen Titipan", stage: 4 },
      { href: "/gudang/pembelian", label: "Pembelian Supplier", stage: 5 },
      { href: "/gudang/mutasi", label: "Waste & Transfer Stok", stage: 5 },
      { href: "/pengguna", label: "Pengguna Matoer", stage: 3 },
      { href: "/laporan", label: "Laporan Keuangan", stage: 4 },
      { href: "/laporan-pos", label: "Laporan POS & Stok", stage: 4 },
      { href: "/catatan-harian", label: "Catatan Harian", stage: 4 },
      { href: "/master/biaya_outlet", label: "Biaya Operasional", stage: 4 },
      { href: "/skema-bagi-hasil", label: "Skema Bagi Hasil", stage: 4 },
      { href: "/tutup-buku", label: "Tutup Buku", stage: 4 },
      { href: "/transfer", label: "Transfer Mitra", stage: 4 },
      { href: "/portal/bep", label: "BEP Outlet", stage: 4 },
      { href: "/hpp-menu", label: "HPP Menu", stage: 4 },
      { href: "/simulasi", label: "Simulasi Kemitraan", stage: 4 },
      { href: "/pengaturan/maintenance", label: "Mode Maintenance", stage: 4 },
      { href: "/pengaturan/qris", label: "QRIS Outlet", stage: 4 },
      { href: "/log", label: "Log Aktivitas", stage: 2 },
    ],
  },
  manajer_area: {
    label: "Manajer Area",
    mascot: "admin",
    accent: "bg-violet-600",
    login: "password",
    allOutlets: false,
    menu: [dash, { href: "/stok-realtime", label: "Stok Real-time", stage: 4 }, { href: "/master/outlet", label: "Outlet Wilayah", stage: 2 }, { href: "/laporan-pos", label: "Laporan POS & Stok", stage: 4 }],
  },
  finance: {
    label: "Finance / Akuntan",
    mascot: "akunting",
    accent: "bg-green-700",
    login: "password",
    allOutlets: true,
    menu: [
      dash,
      { href: "/stok-realtime", label: "Stok Real-time", stage: 4 },
      { href: "/catatan-harian", label: "Catatan Harian", stage: 4 },
      { href: "/master/biaya_outlet", label: "Biaya Operasional", stage: 4 },
      { href: "/persediaan", label: "Persediaan & HPP", stage: 4 },
      { href: "/rumus-hpp", label: "Rumus HPP", stage: 4 },
      { href: "/titipan", label: "Titipan Produk", stage: 4 },
      { href: "/master/produsen_titipan", label: "Produsen Titipan", stage: 4 },
      { href: "/laporan", label: "Laporan Keuangan", stage: 4 },
      { href: "/laporan-pos", label: "Laporan POS & Stok", stage: 4 },
      { href: "/skema-bagi-hasil", label: "Skema Bagi Hasil", stage: 4 },
      { href: "/tutup-buku", label: "Tutup Buku", stage: 4 },
      { href: "/transfer", label: "Transfer Mitra", stage: 4 },
      { href: "/portal/bep", label: "BEP Outlet", stage: 4 },
      { href: "/penggajian", label: "Penggajian (lihat)", stage: 5 },
      { href: "/simulasi", label: "Simulasi Kemitraan", stage: 4 },
      { href: "/master/perjanjian", label: "Perjanjian & Investasi", stage: 2 },
    ],
  },
  hrd: {
    label: "HRD",
    mascot: "admin",
    accent: "bg-violet-600",
    login: "password",
    allOutlets: true,
    menu: [
      dash,
      { href: "/master/karyawan", label: "Karyawan", stage: 2 },
      { href: "/pengguna", label: "Pengguna Matoer", stage: 4 },
      { href: "/persediaan", label: "Persediaan & HPP", stage: 4 },
      { href: "/jadwal", label: "Jadwal Shift", stage: 5 },
      { href: "/absensi", label: "Rekap Absensi", stage: 5 },
      { href: "/persetujuan", label: "Persetujuan Izin & Tukar", stage: 5 },
      { href: "/penggajian", label: "Penggajian & Slip Gaji", stage: 5 },
    ],
  },
  admin_pusat: {
    label: "Admin Pusat",
    mascot: "admin",
    accent: "bg-violet-600",
    login: "password",
    allOutlets: true,
    menu: [
      dash,
      { href: "/dashboard-pos", label: "Dashboard POS", stage: 4 },
      { href: "/absensi", label: "Rekap Absensi", stage: 5 },
      { href: "/stok-realtime", label: "Stok Real-time", stage: 4 },
      { href: "/pengguna", label: "Pengguna Matoer", stage: 3 },
      { href: "/master/outlet", label: "Outlet", stage: 2 },
      { href: "/master/kategori_menu", label: "Kategori Menu", stage: 2 },
      { href: "/master/menu", label: "Menu", stage: 2 },
      { href: "/master/varian", label: "Additional & Varian", stage: 2 },
      { href: "/master/resep", label: "Resep", stage: 2 },
      { href: "/master/bahan", label: "Bahan Baku", stage: 2 },
      { href: "/gudang/stok", label: "Stok Gudang", stage: 4 },
      { href: "/gudang/kiriman", label: "Kiriman Bahan", stage: 4 },
      { href: "/persediaan", label: "Persediaan & HPP", stage: 4 },
      { href: "/rumus-hpp", label: "Rumus HPP", stage: 4 },
      { href: "/titipan", label: "Titipan Produk", stage: 4 },
      { href: "/master/produsen_titipan", label: "Produsen Titipan", stage: 4 },
      { href: "/gudang/pembelian", label: "Pembelian Supplier", stage: 5 },
      { href: "/gudang/mutasi", label: "Waste & Transfer Stok", stage: 5 },
      { href: "/master/supplier", label: "Supplier", stage: 2 },
      { href: "/master/mitra", label: "Mitra", stage: 2 },
      { href: "/master/perjanjian", label: "Perjanjian & Investasi", stage: 2 },
      { href: "/laporan", label: "Laporan Keuangan", stage: 4 },
      { href: "/laporan-pos", label: "Laporan POS & Stok", stage: 4 },
      { href: "/tutup-buku", label: "Tutup Buku", stage: 4 },
      { href: "/transfer", label: "Transfer Mitra", stage: 4 },
      { href: "/portal/bep", label: "BEP Outlet", stage: 4 },
      { href: "/proyek", label: "Proyek Pembangunan", stage: 4 },
      { href: "/pengaturan/maintenance", label: "Mode Maintenance", stage: 4 },
      { href: "/pengaturan/qris", label: "QRIS Outlet", stage: 4 },
      { href: "/simulasi", label: "Simulasi Kemitraan", stage: 4 },
    ],
  },
  admin_gudang: {
    label: "Admin Gudang Pusat",
    mascot: "gudang",
    accent: "bg-orange-600",
    login: "password",
    allOutlets: true,
    menu: [
      dash,
      { href: "/stok-realtime", label: "Stok Real-time", stage: 4 },
      { href: "/gudang/stok", label: "Bahan & Stok Gudang", stage: 4 },
      { href: "/pengaturan/qris", label: "QRIS Outlet", stage: 4 },
      { href: "/laporan-pos", label: "Laporan POS & Stok", stage: 4 },
      { href: "/gudang/pembelian", label: "Pembelian Supplier", stage: 5 },
      { href: "/gudang/mutasi", label: "Waste & Transfer Stok", stage: 5 },
      { href: "/gudang/kiriman", label: "Kiriman ke Outlet", stage: 4 },
      { href: "/stok", label: "Opname Outlet", stage: 4 },
      { href: "/persediaan", label: "Persediaan & HPP", stage: 4 },
      { href: "/titipan", label: "Titipan Produk", stage: 4 },
      { href: "/master/produsen_titipan", label: "Produsen Titipan", stage: 4 },
      { href: "/master/bahan", label: "Data Bahan (master)", stage: 2 },
      { href: "/master/menu", label: "Menu & Harga POS", stage: 2 },
      { href: "/master/kategori_menu", label: "Kategori Menu", stage: 2 },
      { href: "/hpp-menu", label: "HPP Menu", stage: 4 },
      { href: "/pengguna", label: "Pengguna Matoer", stage: 4 },
      { href: "/master/supplier", label: "Supplier", stage: 2 },
    ],
  },
  spv: {
    label: "Kepala Outlet / SPV",
    mascot: "kasir",
    accent: "bg-red-600",
    login: "password",
    allOutlets: false,
    menu: [
      dash,
      { href: "/stok-realtime", label: "Stok Real-time", stage: 4 },
      { href: "/laporan-pos", label: "Laporan POS & Stok", stage: 4 },
      { href: "/kasir", label: "Buka Aplikasi POS", stage: 3 },
      { href: "/gudang/kiriman", label: "Kiriman Masuk", stage: 4 },
      { href: "/catatan-harian", label: "Catatan Harian", stage: 4 },
      { href: "/stok", label: "Stok & Opname", stage: 4 },
      { href: "/persediaan", label: "Persediaan & HPP", stage: 4 },
      { href: "/titipan", label: "Titipan Produk", stage: 4 },
      { href: "/master/produsen_titipan", label: "Produsen Titipan", stage: 4 },
      { href: "/gudang/mutasi", label: "Waste & Transfer Stok", stage: 5 },
      { href: "/permintaan", label: "Permintaan Barang", stage: 6 },
      { href: "/jadwal", label: "Jadwal Shift", stage: 5 },
      { href: "/absensi", label: "Rekap Absensi", stage: 5 },
      { href: "/persetujuan", label: "Persetujuan Izin & Tukar", stage: 5 },
    ],
  },
  kasir: {
    label: "Kasir",
    mascot: "kasir",
    accent: "bg-red-600",
    login: "pin",
    allOutlets: false,
    menu: [
      dash,
      { href: "/pos", label: "Layar POS", stage: 3 },
      { href: "/shift", label: "Shift Saya", stage: 5 },
      { href: "/slip", label: "Absensi & Slip Gaji", stage: 5 },
    ],
  },
  barista: {
    label: "Barista",
    mascot: "kasir",
    accent: "bg-red-600",
    login: "pin",
    allOutlets: false,
    menu: [
      dash,
      { href: "/antrean", label: "Antrean Pesanan", stage: 3 },
      { href: "/shift", label: "Shift Saya", stage: 5 },
      { href: "/slip", label: "Absensi & Slip Gaji", stage: 5 },
    ],
  },
  mitra: {
    label: "Mitra",
    mascot: "mitra",
    accent: "bg-blue-600",
    login: "otp",
    allOutlets: false,
    menu: [
      dash,
      { href: "/portal/pembangunan", label: "Progres Pembangunan", stage: 4 },
      { href: "/laporan", label: "Laporan Bulanan", stage: 4 },
      { href: "/portal/bep", label: "Progres BEP", stage: 4 },
      { href: "/portal/pos", label: "POS Outlet (omzet harian)", stage: 4 },
      { href: "/portal/karyawan", label: "Karyawan Outlet", stage: 4 },
    ],
  },
  pic: {
    label: "PIC / Kontraktor",
    mascot: "mitra",
    accent: "bg-blue-600",
    login: "otp",
    allOutlets: false,
    menu: [dash, { href: "/proyek", label: "Progres Pekerjaan", stage: 4 }],
  },
  pemantau_pos: {
    label: "Tamu Matur",
    mascot: "kasir",
    accent: "bg-teal-600",
    login: "password",
    allOutlets: false,
    outletOpsional: true,
    menu: [{ href: PANTAU_POS, label: "Penjualan POS", stage: 1 }],
  },
  tablet: {
    label: "Tablet POS Outlet",
    mascot: "kasir",
    accent: "bg-red-600",
    login: "password",
    allOutlets: false,
    menu: [],
  },
};

const operasionalMenu: Partial<Record<Role, MenuItem[]>> = {
 owner: [{href:"/operasional/kiriman",label:"Invoice & Penerimaan Barang",stage:5},{href:"/setoran",label:"Setoran & Rekonsiliasi",stage:5},{href:"/kasbon",label:"Kasbon Karyawan",stage:5},{href:"/stok",label:"Opname Outlet",stage:5}],
 admin_pusat:[{href:"/operasional/kiriman",label:"Invoice & Penerimaan Barang",stage:5},{href:"/setoran",label:"Setoran & Rekonsiliasi",stage:5}],
 admin_gudang:[{href:"/operasional/kiriman",label:"Invoice & Penerimaan Barang",stage:5}],
 finance:[{href:"/operasional/kiriman",label:"Invoice Pengiriman",stage:5},{href:"/setoran",label:"Setoran & Rekonsiliasi",stage:5},{href:"/stok",label:"Opname Outlet",stage:5},{href:"/kasbon",label:"Kasbon (lihat)",stage:5}],
 hrd:[{href:"/stok",label:"Opname Outlet",stage:5},{href:"/titipan",label:"Titipan Dessert",stage:5},{href:"/kasbon",label:"Kasbon Karyawan",stage:5}],
 spv:[{href:"/operasional/kiriman",label:"Pemeriksaan Kiriman",stage:5},{href:"/setoran",label:"Setoran Omzet",stage:5}],
};
for (const [role,items] of Object.entries(operasionalMenu)) ROLES[role as Role].menu.push(...items);

for (const role of ["owner", "hrd", "admin_pusat"] as Role[]) ROLES[role].menu.push({ href: "/profil-karyawan", label: "Profil Karyawan", stage: 5 });
for (const role of ["owner","hrd","admin_gudang","admin_pusat","spv","finance"] as Role[]) ROLES[role].menu.push({href:"/pengaturan/pos",label:role==="finance"?"Rekap Kas Tim":"Akses Kasir POS Outlet",stage:5});

export function findMenu(role: Role, href: string): MenuItem | undefined {
  return ROLES[role].menu.find((m) => m.href === href);
}


// Aplikasi POS terpisah di /kasir (login kode staf + PIN, dipakai di perangkat outlet)
export const POS_ROLES: Role[] = ["kasir", "barista", "spv", "tablet"];
/** peran yang hanya memakai aplikasi POS, tidak masuk dashboard utama */
export const POS_ONLY: Role[] = ["kasir", "barista"];
export const BISA_JUAL: Role[] = ["kasir", "spv", "tablet"];
/** akun perangkat: hanya membuka POS di /pos, tidak punya dashboard/absen */
export const TABLET: Role = "tablet";

for(const role of ["owner","admin_pusat","admin_gudang","finance"] as Role[])ROLES[role].menu.push({href:"/gudang/opname",label:"Opname Gudang",stage:4},{href:"/gudang/laba-rugi",label:"Laba Rugi Gudang",stage:4});

for(const role of ["owner","admin_pusat","admin_gudang"] as Role[])ROLES[role].menu.push({href:"/gudang/pengaturan-dokumen",label:"Pengaturan Dokumen",stage:4});

for(const role of ["owner","admin_pusat","admin_gudang"] as Role[])ROLES[role].menu.push({href:"/gudang/outlet",label:"Kontak Outlet",stage:4},{href:"/gudang/dokumen-arsip",label:"Arsip Dokumen",stage:4});

for (const role of ["admin_pusat", "admin_gudang"] as Role[]) if (!ROLES[role].menu.some(m => m.href === "/stok")) ROLES[role].menu.push({ href: "/stok", label: "Opname Outlet", stage: 4 });
