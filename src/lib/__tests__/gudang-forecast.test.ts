import { it, expect } from "vitest";
import { bulanAcuan, hitungForecast, labelData, lajuHarian, type BahanForecast } from "../gudang-forecast";

const kopi: BahanForecast = { id: "k", nama: "Kopi", kategori: null, satuan_beli: "pack", satuan_pakai: "g", konversi: 1000, harga_beli: 180000, stok_min: 500 };

it("covers at most three past months plus the current month from the first data day", () => {
  expect(bulanAcuan("2026-11-10", "2026-10-21").map((a) => [a.ym, a.hari])).toEqual([["2026-10", 11], ["2026-11", 10]]);
  expect(bulanAcuan("2026-11-10", "2026-01-01").map((a) => a.ym)).toEqual(["2026-08", "2026-09", "2026-10", "2026-11"]);
  expect(bulanAcuan("2026-11-10", null)).toEqual([]);
});

it("weights recent full months more and follows a rising trend", () => {
  const acuan = bulanAcuan("2026-12-01", "2026-09-01");
  // 30, 40, 50 per hari (Sep 30 hari, Okt 31, Nov 30); Desember baru 1 hari diabaikan
  const r = lajuHarian({ "2026-09": 900, "2026-10": 1240, "2026-11": 1500 }, acuan);
  expect(r).toBeGreaterThan(50);
  expect(r).toBeLessThan(56);
  // data awal (< 1 bulan): laju sederhana dari hari tercakup
  expect(lajuHarian({ "2026-10": 110 }, bulanAcuan("2026-10-31", "2026-10-21"))).toBeCloseTo(10, 5);
});

it("uses the larger of shipments vs POS usage, adds buffer and minimum, rounds purchases up to whole packs", () => {
  const [h] = hitungForecast({
    bahan: [kopi],
    bulan: [
      { p: "2026-10-01", b: "k", kirim: 3100, pakai: 6200 },
      { p: "2026-11-01", b: "k", kirim: 0, pakai: 0 },
    ],
    stok: { k: 2000 },
    hariIni: "2026-10-31",
    awalData: "2026-10-01",
    bufferPersen: 10,
  });
  expect(h.ratePakai).toBeCloseTo(200, 5);
  expect(h.kebutuhan).toBeCloseTo(6000, 5); // November 30 hari
  expect(h.saran).toBeCloseTo(6000 * 1.1 + 500 - 2000, 5);
  expect(h.saranKemasan).toBe(6);
  expect(h.estimasi).toBe(6 * 180000);
  expect(h.cukupHari).toBeCloseTo(10, 5);
  expect(h.status).toBe("beli"); // cukup 10 hari (bukan < 7) tetapi perlu tambah stok
});

it("labels idle items and data confidence", () => {
  const [h] = hitungForecast({ bahan: [kopi], bulan: [], stok: { k: 50 }, hariIni: "2026-10-31", awalData: "2026-10-21", bufferPersen: 10 });
  expect(h.status).toBe("diam");
  expect(labelData("2026-10-31", "2026-10-21").teks).toMatch(/11 hari/);
  expect(labelData("2027-02-01", "2026-10-21").teks).toBe("3+ bulan data");
});
