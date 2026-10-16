import { it, expect } from "vitest";
import { hitungSimulasi } from "../pos-simulasi";
const menus = [
  {
    id: "kopi",
    nama: "Kopi",
    harga_langsung: 10000,
    harga_ojol: 12000,
    varian: [{ id: "susu", nama: "Susu", tambahan_harga: 2000 }],
  },
];
it("calculates local simulation quantities, unique variants, discount and change", () => {
  expect(
    hitungSimulasi(
      menus,
      [{ menu: "kopi", qty: 2, varian: ["susu", "susu"] }],
      false,
      1000,
      30000,
    ),
  ).toMatchObject({ subtotal: 24000, total: 23000, kembalian: 7000 });
});
it("supports simulated ojol prices without any transaction or stock dependency", () => {
  expect(
    hitungSimulasi(
      menus,
      [{ menu: "kopi", qty: 1, varian: [] }],
      true,
      0,
      15000,
    ).total,
  ).toBe(12000);
});
it("rejects invalid money, quantities and unrelated variants", () => {
  for (const i of [
    { menu: "kopi", qty: -1, varian: [] },
    { menu: "kopi", qty: 1, varian: ["lain"] },
  ])
    expect(() => hitungSimulasi(menus, [i], false, 0, 20000)).toThrow();
  expect(() =>
    hitungSimulasi(
      menus,
      [{ menu: "kopi", qty: 1, varian: [] }],
      false,
      10001,
      20000,
    ),
  ).toThrow("Diskon");
  expect(() =>
    hitungSimulasi(
      menus,
      [{ menu: "kopi", qty: 1, varian: [] }],
      false,
      0,
      9999,
    ),
  ).toThrow("kurang");
});
