import { expect, it } from "vitest";
import { jamDalamPekan, pekanTanggal } from "../jam-penjualan";
it("membagi berdasarkan tanggal, bukan hari Senin", () => {
  const p = pekanTanggal("2026-11-01", "2026-11-30");
  expect(p.map(x => [x.dari, x.sampai])).toEqual([["2026-11-01","2026-11-07"],["2026-11-08","2026-11-14"],["2026-11-15","2026-11-21"],["2026-11-22","2026-11-28"],["2026-11-29","2026-11-30"]]);
  expect(new Date(p[0].dari).getUTCDay()).toBe(0);
});
it("membatasi sampai hari berjalan dan tidak menyertakan bulan lain", () => {
  expect(pekanTanggal("2026-11-01", "2026-11-09").map(p => p.tanggal.length)).toEqual([7,2]);
  expect(pekanTanggal("2026-12-01", "2026-12-31").at(-1)?.tanggal.length).toBe(3);
  expect(pekanTanggal("2027-02-01", "2027-02-28")).toHaveLength(4);
  expect(pekanTanggal("2028-02-01", "2028-02-29").at(-1)?.tanggal).toEqual(["2028-02-29"]);
});
it("memisahkan bulan dan tahun pada rentang kustom", () => {
  expect(pekanTanggal("2026-12-30", "2027-01-02").map(p => p.tanggal)).toEqual([["2026-12-30","2026-12-31"],["2027-01-01","2027-01-02"]]);
  expect(pekanTanggal("2026-11-09", "2026-11-01")).toEqual([]);
});
it("tidak mencampur jam tanggal yang sama harinya pada pekan berbeda", () => {
  const cells = [{tgl:"2026-11-01",jam:10,trx:2},{tgl:"2026-11-08",jam:10,trx:7}];
  expect(jamDalamPekan(cells,pekanTanggal("2026-11-01","2026-11-09")[0])).toEqual([cells[0]]);
});
