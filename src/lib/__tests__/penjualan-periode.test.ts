import { describe, expect, it } from "vitest";
import { penjualanDalamPeriode } from "../penjualan-periode";

describe("tanggal grafik penjualan", () => {
  it("membatasi November sampai tanggal berjalan tanpa menambahkan omzet Oktober ke 1 November", () => {
    const data = Object.freeze([
      Object.freeze({ tgl: "2026-10-31", omzet: 70000 }),
      Object.freeze({ tgl: "2026-11-01", omzet: 1688000 }),
      Object.freeze({ tgl: "2026-11-09", omzet: 100000 }),
      Object.freeze({ tgl: "2026-11-10", omzet: 5000 }),
    ]);
    const hasil = penjualanDalamPeriode(data, "2026-11-01", "2026-11-09");
    expect(hasil).toEqual([data[1], data[2]]);
    expect(hasil[0]).toBe(data[1]);
    expect([...hasil].sort((a, b) => a.omzet - b.omzet)[0].tgl).toBe("2026-11-09");
    expect(data[0].omzet).toBe(70000);
  });
  it("berlaku saat pergantian tahun dan tetap menyertakan tanggal batas", () => {
    const data = ["2026-12-31", "2027-01-01", "2027-01-02", "2027-02-01"].map(tgl => ({ tgl }));
    expect(penjualanDalamPeriode(data, "2027-01-01", "2027-01-02")).toEqual(data.slice(1, 3));
  });
  it("mendukung bulan lampau dan periode kustom serta hasil kosong", () => {
    const data = [{ tgl: "2026-10-31", omzet: 0 }, { tgl: "2026-11-01", omzet: 10 }];
    expect(penjualanDalamPeriode(data, "2026-10-01", "2026-10-31")).toEqual([data[0]]);
    expect(penjualanDalamPeriode(data, "2026-10-31", "2026-11-01")).toEqual(data);
    expect(penjualanDalamPeriode(data, "2026-12-01", "2026-12-09")).toEqual([]);
  });
});
