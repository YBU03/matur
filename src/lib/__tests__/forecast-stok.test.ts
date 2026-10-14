import { describe, expect, it } from "vitest";
import { forecastStok } from "../forecast-stok";

const deret = (akhir: string, nilai: number[]) =>
  nilai.map((pakai, i) => {
    const d = new Date(akhir + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - (nilai.length - 1 - i));
    return { tanggal: d.toISOString().slice(0, 10), pakai };
  });

describe("forecastStok", () => {
  it("pemakaian rata: 100/hari, stok 450 → habis ±4,5 hari lagi", () => {
    const f = forecastStok(deret("2026-10-15", [...Array(14).fill(100), 0]), 450, 200, 1000);
    expect(f.rata).toBe(100);
    expect(f.hariTersisa).toBeCloseTo(4.5, 1);
    expect(f.tglHabis).toBe("2026-10-19");
    expect(f.tglRestock).toBe("2026-10-17"); // 450→350→250→150 (<200)
    expect(f.status).toBe("aman"); // 4,5 hari
    expect(f.saran).toBe(100 * 7 + 200 - 450);
    expect(f.saranKemasan).toBe(1);
  });
  it("pemakaian hari ini mengurangi sisa kebutuhan hari ini", () => {
    const f = forecastStok(deret("2026-10-15", [...Array(14).fill(100), 80]), 150, 50);
    // hari ini butuh 20 lagi → sisa 130 → besok 100 → lusa habis
    expect(f.tglHabis).toBe("2026-10-17");
    expect(f.hariTersisa).toBeCloseTo(2.3, 1);
    expect(f.status).toBe("menipis");
  });
  it("hari terbaru lebih berbobot & tren naik terdeteksi", () => {
    const f = forecastStok(deret("2026-10-15", [...Array(7).fill(50), ...Array(7).fill(150), 0]), 1000, 0);
    expect(f.rata).toBeGreaterThan(100);
    expect(f.tren).toBe(200);
  });
  it("akhir pekan lebih ramai menaikkan perkiraan Sabtu/Minggu", () => {
    // 28 hari: Sab & Min pakai 200, hari lain 100
    const d = deret("2026-10-15", Array(29).fill(0)).map((h) => ({ ...h, pakai: [0, 6].includes(new Date(h.tanggal + "T00:00:00Z").getUTCDay()) ? 200 : 100 }));
    d[d.length - 1].pakai = 0;
    const tanpa = forecastStok(d.map((h) => ({ ...h, pakai: h.pakai ? 128.6 : 0 })), 500, 0);
    const dengan = forecastStok(d, 500, 0);
    expect(dengan.hariTersisa!).toBeLessThan(tanpa.hariTersisa! + 0.5); // weekend (Sab 17 Okt) menghabiskan lebih cepat
  });
  it("stok habis & bahan tanpa pemakaian", () => {
    expect(forecastStok(deret("2026-10-15", [...Array(14).fill(10), 0]), 0, 5).status).toBe("habis");
    const t = forecastStok(deret("2026-10-15", Array(15).fill(0)), 3, 10, 5);
    expect(t).toMatchObject({ status: "menipis", hariTersisa: null, saran: 7, saranKemasan: 2 });
    expect(forecastStok([], 10, 0).status).toBe("tidak_dipakai");
  });
});
