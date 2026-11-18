import { expect, it } from "vitest";
import { labelKuota, labelNilai, rentangJam, rentangTanggal, statusPromo, urutkanPromo } from "../promo-tampilan";
import type { Promo } from "../promo";

const now = Date.parse("2026-11-18T05:00:00Z"); // 12.00 WIB
const p = (o: Partial<Promo> = {}): Promo => ({ id: "x", nama: "A", aktif: true, mulai: "2026-11-18", selesai: "2026-11-30", jam_mulai: "00:00", jam_selesai: "23:59:59", semua_outlet: true, outlet_ids: [], aturan: [{ menu_id: "m", varian_ids: [], jenis: "persen", nilai: 20 }], kuota: null, per_menu: false, bersama: false, boleh_manual: false, versi: 1, ...o });

it("status mengikuti tanggal & jam WIB", () => {
  expect(statusPromo(p(), now)).toBe("berjalan");
  expect(statusPromo(p({ aktif: false }), now)).toBe("nonaktif");
  expect(statusPromo(p({ mulai: "2026-11-20" }), now)).toBe("terjadwal");
  expect(statusPromo(p({ selesai: "2026-11-17" }), now)).toBe("selesai");
  expect(statusPromo(p({ selesai: "2026-11-18", jam_selesai: "11:00:00" }), now)).toBe("selesai");
  expect(statusPromo(p({ selesai: "2026-11-18", jam_selesai: "13:00" }), now)).toBe("berjalan");
});

it("format tanggal dan jam mudah dibaca", () => {
  expect(rentangTanggal("2026-11-18", "2026-11-18")).toBe("18 Nov 2026");
  expect(rentangTanggal("2026-11-18", "2026-11-30")).toBe("18–30 Nov 2026");
  expect(rentangTanggal("2026-11-28", "2026-12-03")).toBe("28 Nov – 3 Des 2026");
  expect(rentangTanggal("2026-12-28", "2027-01-02")).toBe("28 Des 2026 – 2 Jan 2027");
  expect(rentangJam("00:00", "23:59:59")).toBe("Sepanjang hari");
  expect(rentangJam("07:00:00", "22:00:00")).toBe("07.00–22.00 WIB");
});

it("label nilai promo", () => {
  expect(labelNilai(p())).toBe("Diskon 20%");
  expect(labelNilai(p({ aturan: [{ menu_id: "m", varian_ids: [], jenis: "harga_akhir", nilai: 15000 }] }))).toBe("Harga Rp15.000");
  expect(labelNilai(p({ aturan: [{ menu_id: "m", varian_ids: [], jenis: "potongan", nilai: 5000 }] }))).toBe("Potong Rp5.000");
  expect(labelNilai(p({ aturan: [{ menu_id: "m", varian_ids: [], jenis: "gratis", nilai: 100 }] }))).toBe("Gratis");
  expect(labelNilai(p({ cakupan: "transaksi", nilai_voucher: 15000 }))).toBe("Voucher Rp15.000");
  expect(labelNilai(p({ aturan: [{ menu_id: "a", varian_ids: [], jenis: "persen", nilai: 10 }, { menu_id: "b", varian_ids: [], jenis: "persen", nilai: 30 }] }))).toBe("Diskon 10–30%");
  expect(labelNilai(p({ aturan: [{ menu_id: "a", varian_ids: [], jenis: "persen", nilai: 10 }, { menu_id: "b", varian_ids: [], jenis: "gratis", nilai: 100 }] }))).toBe("Beragam promo");
  expect(labelNilai(p({ aturan: [] }))).toBe("Belum ada menu");
});

it("kuota & urutan", () => {
  expect(labelKuota(p())).toBe("Tanpa batas kuota");
  expect(labelKuota(p({ kuota: 50, per_menu: true }))).toBe("Kuota 50 item/hari · per menu · per outlet");
  const list = urutkanPromo([p({ id: "s", selesai: "2026-11-01" }), p({ id: "n", aktif: false }), p({ id: "t", mulai: "2026-11-25" }), p({ id: "b" })], now);
  expect(list.map((x) => x.id)).toEqual(["b", "t", "n", "s"]);
});
