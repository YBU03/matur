import { describe, expect, it } from "vitest";
import { nomorSupport, tautanSupport } from "../support-outlet";
import { ROLES } from "../roles";

describe("Support Outlet", () => {
  it.each(["+62 851-3599-0588", "0851 3599 0588", "6285135990588"])(
    "normalizes %s to an exact WhatsApp destination",
    (input) => {
      expect(nomorSupport(input)).toBe("6285135990588");
      expect(tautanSupport(input)).toEqual({
        wa: "https://wa.me/6285135990588",
        telepon: "tel:+6285135990588",
      });
    },
  );
  it.each([
    "",
    "0851abc35990588",
    "javascript:alert(1)",
    "+6285",
    "+628513599058812345",
    "++6285135990588",
  ])("rejects invalid contacts: %s", (input) =>
    expect(tautanSupport(input)).toBeNull(),
  );
  it("keeps admin management separate from the Mitra contact menu", () => {
    const manage = "/pengaturan/support-outlet";
    expect(ROLES.owner.menu.some((m) => m.href === manage)).toBe(true);
    expect(ROLES.admin_pusat.menu.some((m) => m.href === manage)).toBe(true);
    for (const [role, def] of Object.entries(ROLES))
      if (!["owner", "admin_pusat"].includes(role))
        expect(def.menu.some((m) => m.href === manage)).toBe(false);
    expect(ROLES.mitra.menu).toContainEqual({
      href: "/portal/support-outlet",
      label: "Support Outlet",
      stage: 4,
    });
  });
});
