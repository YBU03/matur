import { describe, expect, it } from "vitest";
import { pindahKegiatan, tujuanGeser } from "../urutan-timeline";

describe("urutan timeline manual", () => {
  it("pindah turun tetap menjaga baris lain dan input asli", () => {
    const ids = ["a", "b", "c", "d"];
    expect(pindahKegiatan(ids, "a", 2)).toEqual(["b", "c", "a", "d"]);
    expect(ids).toEqual(["a", "b", "c", "d"]);
  });
  it("pindah naik dan batas posisi", () => {
    expect(pindahKegiatan(["a", "b", "c"], "c", 0)).toEqual(["c", "a", "b"]);
    expect(pindahKegiatan(["a", "b", "c"], "a", 99)).toEqual(["b", "c", "a"]);
    expect(pindahKegiatan(["a", "b"], "b", -1)).toEqual(["b", "a"]);
  });
  it("abaikan ID hilang, posisi sama, dan tujuan tidak valid", () => {
    const ids = ["a", "b"];
    expect(pindahKegiatan(ids, "x", 0)).toBe(ids);
    expect(pindahKegiatan(ids, "a", 0)).toBe(ids);
    expect(pindahKegiatan(ids, "a", NaN)).toBe(ids);
  });
  it("menghitung sisipan dengan tinggi baris berbeda tanpa memasukkan baris asal", () => {
    const baris = [{ id: "a", tengah: 50 }, { id: "b", tengah: 200 }, { id: "c", tengah: 310 }];
    expect(tujuanGeser(25, baris, "b")).toBe(0);
    expect(tujuanGeser(90, baris, "b")).toBe(1);
    expect(tujuanGeser(400, baris, "b")).toBe(2);
    expect(tujuanGeser(220, baris, "a")).toBe(1);
  });
});
