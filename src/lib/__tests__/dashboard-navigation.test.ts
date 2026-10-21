import { describe, expect, it } from "vitest";
import {
  DASHBOARD_POS,
  isAdminDashboardRole,
  mobileQuickLinks,
} from "../dashboard-navigation";
import { PANTAU_POS, ROLES, type Role } from "../roles";

describe("admin and guest POS navigation", () => {
  it.each(["owner", "admin_pusat"] as Role[])(
    "gives %s exactly Beranda/POS/Laporan shortcuts",
    (role) => {
      expect(mobileQuickLinks(role)).toEqual([
        { href: "/dashboard", label: "Beranda" },
        { href: DASHBOARD_POS, label: "POS" },
        { href: "/laporan", label: "Laporan" },
      ]);
      expect(ROLES[role].menu.some((m) => m.href === DASHBOARD_POS)).toBe(true);
    },
  );
  it("only permits existing admin roles to open the new dashboard", () => {
    for (const role of Object.keys(ROLES) as Role[])
      expect(isAdminDashboardRole(role)).toBe(
        ["owner", "admin_pusat"].includes(role),
      );
  });
  it("renames the guest without changing its key, destination or outlet restrictions", () => {
    expect(ROLES.pemantau_pos.label).toBe("Tamu Matur");
    expect(ROLES.pemantau_pos.allOutlets).toBe(false);
    expect(mobileQuickLinks("pemantau_pos")).toEqual([
      { href: PANTAU_POS, label: "POS" },
      { href: "/profil", label: "Profil" },
    ]);
    expect(ROLES.pemantau_pos.menu.map((m) => m.href)).toEqual([PANTAU_POS]);
  });
  it("does not add the admin dashboard to other role menus or shortcuts", () => {
    for (const role of Object.keys(ROLES) as Role[])
      if (!isAdminDashboardRole(role)) {
        expect(
          mobileQuickLinks(role).some((m) => m.href === DASHBOARD_POS),
        ).toBe(false);
        expect(ROLES[role].menu.some((m) => m.href === DASHBOARD_POS)).toBe(
          false,
        );
      }
  });
});
