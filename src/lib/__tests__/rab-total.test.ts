import { describe, expect, it } from "vitest";
import { totalEstimasiRab } from "../rab-total";
describe("grand total RAB", () => {
  it("sums line totals across all categories without multiplying quantities again", () => {
    const items = [
      { kategori: "Material", qty: 20, harga_estimasi: 50000 },
      { kategori: "Keperluan Interior", qty: 2, harga_estimasi: 250000 },
      { kategori: "Pertukangan", qty: 14, harga_estimasi: 1540000 },
    ];
    expect(totalEstimasiRab(items)).toBe(1840000);
    expect(
      totalEstimasiRab([
        ...items,
        { kategori: "Material", qty: 500, harga_estimasi: 60000 },
      ]),
    ).toBe(1900000);
  });
  it("shows zero with no active RAB items instead of a manual budget", () => {
    expect(totalEstimasiRab([])).toBe(0);
  });
});
