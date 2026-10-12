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
  | "pic";

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
  menu: MenuItem[];
};

/** tahap pengembangan yang sudah selesai */
export const CURRENT_STAGE = 4;

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
      { href: "/master/outlet", label: "Outlet", stage: 2 },
      { href: "/master/mitra", label: "Mitra", stage: 2 },
      { href: "/master/perjanjian", label: "Perjanjian Mitra", stage: 2 },
      { href: "/proyek", label: "Proyek Pembangunan", stage: 4 },
      { href: "/master/karyawan", label: "Karyawan", stage: 2 },
      { href: "/master/menu", label: "Menu", stage: 2 },
      { href: "/gudang/stok", label: "Stok Gudang", stage: 4 },
      { href: "/pengguna", label: "Pengguna & Akses", stage: 3 },
      { href: "/laporan", label: "Laporan Keuangan", stage: 4 },
      { href: "/simulasi", label: "Mode Simulasi", stage: 9 },
      { href: "/log", label: "Log Aktivitas", stage: 2 },
    ],
  },
  manajer_area: {
    label: "Manajer Area",
    mascot: "admin",
    accent: "bg-violet-600",
    login: "password",
    allOutlets: false,
    menu: [dash, { href: "/master/outlet", label: "Outlet Wilayah", stage: 2 }],
  },
  finance: {
    label: "Finance / Akuntan",
    mascot: "akunting",
    accent: "bg-green-700",
    login: "password",
    allOutlets: true,
    menu: [
      dash,
      { href: "/biaya", label: "Biaya Operasional", stage: 7 },
      { href: "/laporan", label: "Laporan Keuangan", stage: 4 },
      { href: "/tutup-buku", label: "Tutup Buku", stage: 7 },
      { href: "/transfer", label: "Transfer Mitra", stage: 7 },
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
      { href: "/jadwal", label: "Jadwal Shift", stage: 5 },
      { href: "/absensi", label: "Rekap Absensi", stage: 5 },
      { href: "/penggajian", label: "Penggajian", stage: 8 },
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
      { href: "/pengguna", label: "Pengguna & Persetujuan", stage: 3 },
      { href: "/master/outlet", label: "Outlet", stage: 2 },
      { href: "/master/kategori_menu", label: "Kategori Menu", stage: 2 },
      { href: "/master/menu", label: "Menu", stage: 2 },
      { href: "/master/varian", label: "Varian Menu", stage: 2 },
      { href: "/master/resep", label: "Resep", stage: 2 },
      { href: "/master/bahan", label: "Bahan Baku", stage: 2 },
      { href: "/gudang/stok", label: "Stok Gudang", stage: 4 },
      { href: "/master/supplier", label: "Supplier", stage: 2 },
      { href: "/master/mitra", label: "Mitra", stage: 2 },
      { href: "/master/perjanjian", label: "Perjanjian & Investasi", stage: 2 },
      { href: "/proyek", label: "Proyek Pembangunan", stage: 4 },
      { href: "/simulasi", label: "Mode Simulasi", stage: 9 },
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
      { href: "/gudang/stok", label: "Bahan & Stok Gudang", stage: 4 },
      { href: "/gudang/pembelian", label: "Pembelian Supplier", stage: 6 },
      { href: "/gudang/kiriman", label: "Kiriman ke Outlet", stage: 6 },
      { href: "/master/bahan", label: "Data Bahan (master)", stage: 2 },
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
      { href: "/kasir", label: "Buka Aplikasi POS", stage: 3 },
      { href: "/stok", label: "Stok & Opname", stage: 6 },
      { href: "/permintaan", label: "Permintaan Barang", stage: 6 },
      { href: "/jadwal", label: "Jadwal Shift", stage: 5 },
      { href: "/persetujuan", label: "Persetujuan", stage: 5 },
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
      { href: "/slip", label: "Absensi & Slip Gaji", stage: 8 },
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
      { href: "/slip", label: "Absensi & Slip Gaji", stage: 8 },
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
      { href: "/portal/laporan", label: "Laporan Bulanan", stage: 9 },
      { href: "/portal/bep", label: "Progres BEP", stage: 9 },
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
};

export function findMenu(role: Role, href: string): MenuItem | undefined {
  return ROLES[role].menu.find((m) => m.href === href);
}


// Aplikasi POS terpisah di /kasir (login kode staf + PIN, dipakai di perangkat outlet)
export const POS_ROLES: Role[] = ["kasir", "barista", "spv"];
/** peran yang hanya memakai aplikasi POS, tidak masuk dashboard utama */
export const POS_ONLY: Role[] = ["kasir", "barista"];
export const BISA_JUAL: Role[] = ["kasir", "spv"];
