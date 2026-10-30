import { it, expect } from "vitest";
import { periodeTitipan } from "../periode-titipan";
it("daily, cross-month Monday week, leap month and invalid date", () => {
  expect(periodeTitipan("2026-10-30", "harian")).toEqual({
    awal: "2026-10-30",
    akhir: "2026-10-30",
  });
  expect(periodeTitipan("2026-11-01", "mingguan")).toEqual({
    awal: "2026-10-26",
    akhir: "2026-11-01",
  });
  expect(periodeTitipan("2028-02-29", "bulanan")).toEqual({
    awal: "2028-02-01",
    akhir: "2028-02-29",
  });
  expect(() => periodeTitipan("2026-02-30", "harian")).toThrow();
});
