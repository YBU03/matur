import { it, expect } from "vitest";
import { tautanTitipan, periodeTitipan } from "../periode-titipan";
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
it.each([
  ["2026-10-01", "2026-10-01", "2026-10-10"],
  ["2026-10-10", "2026-10-01", "2026-10-10"],
  ["2026-10-11", "2026-10-11", "2026-10-20"],
  ["2026-10-20", "2026-10-11", "2026-10-20"],
  ["2026-10-21", "2026-10-21", "2026-10-31"],
  ["2026-11-30", "2026-11-21", "2026-11-30"],
  ["2026-02-28", "2026-02-21", "2026-02-28"],
  ["2028-02-29", "2028-02-21", "2028-02-29"],
])("automatic ten-day period for %s", (tanggal, awal, akhir) => {
  expect(periodeTitipan(tanggal, "sepuluh_hari")).toEqual({ awal, akhir });
});
it("custom range preserves both inclusive dates, including a single day and cross-month periods", () => {
  expect(periodeTitipan("2026-10-01", "kustom", "2026-10-10")).toEqual({
    awal: "2026-10-01",
    akhir: "2026-10-10",
  });
  expect(periodeTitipan("2026-10-14", "kustom", "2026-10-31")).toEqual({
    awal: "2026-10-14",
    akhir: "2026-10-31",
  });
  expect(periodeTitipan("2026-10-31", "kustom", "2026-11-03")).toEqual({
    awal: "2026-10-31",
    akhir: "2026-11-03",
  });
  expect(periodeTitipan("2028-02-29", "kustom", "2028-02-29")).toEqual({
    awal: "2028-02-29",
    akhir: "2028-02-29",
  });
  expect(periodeTitipan("2028-01-01", "kustom", "2028-12-31")).toEqual({
    awal: "2028-01-01",
    akhir: "2028-12-31",
  });
});
it("rejects reversed, empty, impossible and oversized custom ranges", () => {
  expect(() => periodeTitipan("2026-10-14", "kustom", "2026-10-01")).toThrow(
    "Tanggal akhir",
  );
  expect(() => periodeTitipan("2026-10-01", "kustom")).toThrow("valid");
  expect(() => periodeTitipan("2026-10-01", "kustom", "2026-11-31")).toThrow(
    "valid",
  );
  expect(() => periodeTitipan("2028-01-01", "kustom", "2029-01-01")).toThrow(
    "maksimal 366",
  );
});

it("outlet navigation keeps custom dates and omits obsolete end date on standard presets", () => {
  const custom = new URL(
    tautanTitipan("outlet-2", "2026-10-14", "kustom", "2026-10-31"),
    "https://www.matoer.id",
  );
  expect(Object.fromEntries(custom.searchParams)).toEqual({
    outlet: "outlet-2",
    tanggal: "2026-10-14",
    periode: "kustom",
    akhir: "2026-10-31",
  });
  const preset = new URL(
    tautanTitipan("outlet-1", "2026-10-21", "sepuluh_hari", "2026-11-30"),
    "https://www.matoer.id",
  );
  expect(preset.searchParams.has("akhir")).toBe(false);
});
