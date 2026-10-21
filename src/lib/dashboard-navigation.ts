import { CURRENT_STAGE, PANTAU_POS, ROLES, type Role } from "./roles";

export const DASHBOARD_POS = "/dashboard-pos";
export const isAdminDashboardRole = (role: Role) =>
  role === "owner" || role === "admin_pusat";

/** Admin shortcuts stay reachable at any scroll position; guests never link to admin pages. */
export function mobileQuickLinks(
  role: Role,
): { href: string; label: string }[] {
  if (isAdminDashboardRole(role))
    return [
      { href: "/dashboard", label: "Beranda" },
      { href: DASHBOARD_POS, label: "POS" },
      { href: "/laporan", label: "Laporan" },
    ];
  if (role === "pemantau_pos")
    return [
      { href: PANTAU_POS, label: "POS" },
      { href: "/profil", label: "Profil" },
    ];
  const priority = [
    "/proyek",
    "/portal/pembangunan",
    "/laporan",
    "/hpp-menu",
    "/gudang/stok",
    "/pengguna",
    "/kasir",
    "/absensi",
    "/jadwal",
    "/persetujuan",
    "/master/menu",
    "/master/perjanjian",
    "/master/karyawan",
    "/master/outlet",
  ];
  const available = ROLES[role].menu.filter(
    (m) => m.stage <= CURRENT_STAGE && m.href !== "/dashboard",
  );
  return [
    { href: "/dashboard", label: "Beranda" },
    ...available
      .sort(
        (a, b) =>
          (priority.indexOf(a.href) + 1 || 99) -
          (priority.indexOf(b.href) + 1 || 99),
      )
      .slice(0, 3),
  ];
}
