import { it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { pembulatanMargin } from "../pembulatan-margin";
import { PenjelasanMargin } from "@/components/penjelasan-margin";
it("explains September without replacing its original profit", () => {
  const p = pembulatanMargin(84802594, 28441821);
  expect(p.asli).toBeCloseTo(33.5388573137, 10);
  expect(p.tampilan).toBe(33.54);
  expect(p.hitungBalik).toBeCloseTo(28442790.0276, 6);
  expect(p.selisih).toBeCloseTo(969.0276, 6);
  const html = renderToStaticMarkup(
    createElement(PenjelasanMargin, { omzet: 84802594, laba: 28441821 }),
  );
  for (const t of [
    "33,54%",
    "28.441.821",
    "969,03",
    "Tidak mengubah laba",
    "<summary",
    "Margin sebelum pembulatan",
  ])
    expect(html).toContain(t);
});
it("retains negative signs and shows when round-trip is below original profit", () => {
  expect(pembulatanMargin(1000, 333.34).selisih).toBeLessThan(0);
  expect(pembulatanMargin(1000, -333.35).tampilan).toBe(-33.34);
  expect(pembulatanMargin(100, 25).selisih).toBe(0);
});
it("does not invent a zero-sales margin or round-trip value", () => {
  expect(pembulatanMargin(0, -10)).toEqual({
    asli: null,
    tampilan: null,
    hitungBalik: null,
    selisih: null,
  });
  expect(
    renderToStaticMarkup(
      createElement(PenjelasanMargin, { omzet: 0, laba: -10 }),
    ),
  ).toContain("omzet nol");
});
