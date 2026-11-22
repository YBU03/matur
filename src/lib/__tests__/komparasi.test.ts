import { expect, it } from "vitest";
import { gabungNama, kesimpulan, menuSama, metrik, perJam, porsi, ramaiSepi, selisihPersen, trenGabung } from "../komparasi";
import type { Ringkasan } from "@/app/(app)/dashboard/sales";

const ring = (o: Partial<Ringkasan> = {}): Ringkasan => ({ kpi: { omzet: 1000000, trx: 50, hpp: 400000, diskon: 20000 }, harian: [], kanal: [], jam: [], menu: [{ nama: "Kopi", qty: 30, omzet: 600000 }, { nama: "Teh", qty: 10, omzet: 100000 }], outlet: [], shift_terbuka: 0, ...o });

it("metrik, selisih & porsi", () => {
  expect(metrik(ring())).toEqual({ omzet: 1000000, trx: 50, rataStruk: 20000, item: 40, diskon: 20000, hpp: 400000, labaKotor: 600000 });
  expect(metrik(null).trx).toBe(0);
  expect(selisihPersen(120, 100)).toBe(20);
  expect(selisihPersen(80, 100)).toBe(-20);
  expect(selisihPersen(0, 0)).toBeNull();
  expect(porsi(75, 25)).toBe(75);
  expect(porsi(0, 0)).toBe(50);
});

it("jam ramai & sepi mengikuti jam operasional", () => {
  const j = perJam([{ dow: 1, jam: 8, trx: 3 }, { dow: 2, jam: 8, trx: 2 }, { dow: 1, jam: 16, trx: 9 }, { dow: 1, jam: 1, trx: 1 }]);
  expect(j[8]).toBe(5);
  expect(ramaiSepi(j)).toEqual({ ramai: 16, sepi: 1 });
  expect(ramaiSepi(perJam([]))).toEqual({ ramai: null, sepi: null });
});

it("tren: per tanggal (antar outlet) dan per hari ke-n (antar periode)", () => {
  const a = [{ tgl: "2026-11-01", outlet_id: "x", omzet: 100, trx: 1 }, { tgl: "2026-11-02", outlet_id: "x", omzet: 50, trx: 1 }];
  const b = [{ tgl: "2026-10-01", outlet_id: "x", omzet: 70, trx: 1 }];
  expect(trenGabung(a, a, { dari: "2026-11-01", hari: 2 }, { dari: "2026-11-01", hari: 2 }, false)).toEqual([{ label: "1 Nov", a: 100, b: 100 }, { label: "2 Nov", a: 50, b: 50 }]);
  expect(trenGabung(a, b, { dari: "2026-11-01", hari: 2 }, { dari: "2026-10-01", hari: 3 }, true)).toEqual([{ label: "Hari 1", a: 100, b: 70 }, { label: "Hari 2", a: 50, b: 0 }, { label: "Hari 3", a: 0, b: 0 }]);
});

it("gabung nama, menu sama & kesimpulan", () => {
  expect(gabungNama([{ k: "GoFood", omzet: 10 }], [{ k: "GoFood", omzet: 5 }, { k: "Langsung", omzet: 30 }], (x) => x.k)).toEqual([{ name: "Langsung", a: 0, b: 30 }, { name: "GoFood", a: 10, b: 5 }]);
  expect([...menuSama(ring().menu, [{ nama: "Kopi", qty: 1, omzet: 1 }])]).toEqual(["Kopi"]);
  const k = kesimpulan(metrik(ring()), metrik(ring({ kpi: { omzet: 800000, trx: 50, hpp: 0, diskon: 0 } })), "Kominot", "UHB");
  expect(k[0]).toBe("Kominot unggul omzet +25% dibanding UHB.");
  expect(k[1]).toContain("sama kuat");
  expect(kesimpulan(metrik(null), metrik(null), "A", "B")[0]).toContain("Belum ada");
});
