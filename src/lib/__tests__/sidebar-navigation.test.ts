import { it, expect } from "vitest";
import { ROLES, type MenuItem } from "../roles";
import { ADMIN_MENU_GROUPS, kelompokkanMenuAdmin } from "../sidebar-navigation";
it.each(["owner", "admin_pusat"] as const)(
  "groups every %s menu exactly once without changing permissions, labels or source array",
  (role) => {
    const original = structuredClone(ROLES[role].menu);
    const groups = kelompokkanMenuAdmin(ROLES[role].menu);
    const flattened = groups.flatMap((g) => g.items);
    expect(flattened).toHaveLength(original.length);
    expect(new Set(flattened.map((m) => m.href)).size).toBe(original.length);
    expect([...flattened].sort((a, b) => a.href.localeCompare(b.href))).toEqual(
      [...original].sort((a, b) => a.href.localeCompare(b.href)),
    );
    expect(ROLES[role].menu).toEqual(original);
    expect(groups.some((g) => g.title === "Menu Lainnya")).toBe(false);
    expect(groups.map((g) => g.title)).toEqual(
      ADMIN_MENU_GROUPS.map((g) => g.title),
    );
  },
);
it("future menus stay visible in a fallback group and absent permissions are not added", () => {
  const item: MenuItem = { href: "/future", label: "Menu baru", stage: 6 };
  expect(kelompokkanMenuAdmin([item])).toEqual([
    { title: "Menu Lainnya", items: [item] },
  ]);
  expect(kelompokkanMenuAdmin([])).toEqual([]);
});
it("filtered search retains only matching groups and a consistent first result", () => {
  const items = ROLES.admin_pusat.menu.filter((m) =>
    m.label.toLowerCase().includes("menu"),
  );
  const groups = kelompokkanMenuAdmin(items);
  expect(groups.map((g) => g.title)).toEqual(["Menu & Produk"]);
  expect(groups[0].items.map((m) => m.label)).toEqual([
    "Kategori Menu",
    "Menu",
  ]);
});
it("each configured href belongs to a single group", () => {
  const hrefs = ADMIN_MENU_GROUPS.flatMap((g) => g.hrefs);
  expect(new Set(hrefs).size).toBe(hrefs.length);
});
