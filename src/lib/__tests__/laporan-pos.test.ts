import { describe, expect, it } from "vitest";
import { LAPORAN, rentangPreset, tabBoleh } from "../laporan-pos";

describe("rentangPreset", () => {
  const kamis = "2026-10-15"; // Kamis
  it("harian", () => {
    expect(rentangPreset("hari_ini", kamis)).toEqual([kamis, kamis]);
    expect(rentangPreset("kemarin", kamis)).toEqual(["2026-10-14", "2026-10-14"]);
  });
  it("mingguan dimulai Senin", () => {
    expect(rentangPreset("minggu_ini", kamis)).toEqual(["2026-10-12", kamis]);
    expect(rentangPreset("minggu_ini", "2026-10-18")).toEqual(["2026-10-12", "2026-10-18"]); // Minggu
    expect(rentangPreset("7_hari", kamis)).toEqual(["2026-10-09", kamis]);
  });
  it("bulanan", () => {
    expect(rentangPreset("bulan_ini", kamis)).toEqual(["2026-10-01", kamis]);
    expect(rentangPreset("bulan_lalu", kamis)).toEqual(["2026-09-01", "2026-09-30"]);
    expect(rentangPreset("bulan_lalu", "2026-03-10")).toEqual(["2026-02-01", "2026-02-28"]);
    expect(rentangPreset("bulan_lalu", "2026-01-05")).toEqual(["2025-12-01", "2025-12-31"]);
  });
});

describe("katalog", () => {
  it("setiap laporan punya kolom & admin gudang tidak melihat penjualan", () => {
    for (const l of Object.values(LAPORAN)) expect(l.kolom.length).toBeGreaterThan(0);
    expect(tabBoleh("admin_gudang")).toEqual(["pembelian", "produk"]);
  });
});
