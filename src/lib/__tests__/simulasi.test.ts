import { describe, expect, it } from "vitest";
import { simulasikan } from "../simulasi";

const dasar = { investasi: 135_000_000, omzet: 100_000_000, tumbuh: 0, hpp: 40, beban: 20_000_000, sedekah: 2.5, mitra: 55, bulan: 36 };

describe("simulasikan", () => {
  it("menghitung laba bersih sesuai format laporan", () => {
    const r = simulasikan(dasar);
    // laba kotor 60 jt, sedekah 1,5 jt, beban 20 jt → laba bersih 38,5 jt; mitra 55% = 21,175 jt
    expect(Math.round(r.labaBulan1)).toBe(38_500_000);
    expect(Math.round(r.mitraBulan1)).toBe(21_175_000);
    expect(r.bepMitra).toBe(7); // 135 jt / 21,175 jt = 6,4 → bulan ke-7
    expect(r.bepOutlet).toBe(4);
  });
  it("tanpa BEP bila rugi", () => {
    const r = simulasikan({ ...dasar, omzet: 10_000_000 });
    expect(r.bepMitra).toBeNull();
    expect(r.baris[0].bagianMitra).toBe(0);
  });
});
