import { expect, it } from "vitest";
import { syaratPromo, hargaPromoDenganBatas, kanalPromoBoleh, akhirSlot, hargaPromo, hitungMundur, jamLegacy, labelHari, labelKuota, labelNilai, labelWaktu, mulaiLagi, rentangJam, rentangTanggal, statusPromo, urutkanPromo } from "../promo-tampilan";
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
  expect(labelKuota(p({ kuota: 50, per_menu: true }))).toBe("Maks 50 cup/item per hari di setiap outlet, dihitung per menu");
  expect(labelKuota(p({ kuota: 10, cakupan: "transaksi", bersama: true }))).toBe("Maks 10 transaksi per hari untuk semua outlet bersama");
  const list = urutkanPromo([p({ id: "s", selesai: "2026-11-01" }), p({ id: "n", aktif: false }), p({ id: "t", mulai: "2026-11-25" }), p({ id: "b" })], now);
  expect(list.map((x) => x.id)).toEqual(["b", "t", "n", "s"]);
});

it("slot, hari dan hitung mundur sama dengan aturan server", () => {
  const q = p({ mulai: "2026-11-16", selesai: "2026-11-30", hari: [1, 2, 3, 4, 5], slot: [{ mulai: "07:00:00", selesai: "10:00:00" }, { mulai: "15:00:00", selesai: "17:00:00" }, { mulai: "21:00:00", selesai: "01:00:00" }] });
  const t = (s: string) => Date.parse(s);
  expect(akhirSlot(q, t("2026-11-18T08:00:00+07:00"))).toBe(t("2026-11-18T10:00:00+07:00"));
  expect(akhirSlot(q, t("2026-11-18T12:00:00+07:00"))).toBeNull();
  expect(akhirSlot(q, t("2026-11-18T23:30:00+07:00"))).toBe(t("2026-11-19T01:00:00+07:00"));
  expect(akhirSlot(q, t("2026-11-21T00:30:00+07:00"))).toBe(t("2026-11-21T01:00:00+07:00"));
  expect(akhirSlot(q, t("2026-11-21T08:00:00+07:00"))).toBeNull();
  expect(mulaiLagi(q, t("2026-11-18T12:00:00+07:00"))).toBe("15.00");
  expect(mulaiLagi(q, t("2026-11-21T12:00:00+07:00"))).toBeNull();
  expect(labelWaktu(q)).toBe("Sen–Jum · 07.00–10.00 & 15.00–17.00 & 21.00–01.00 WIB");
  expect(labelHari([6, 7])).toBe("Sab, Min");
  expect(labelHari([1, 3, 5])).toBe("Sen, Rab, Jum");
  expect(labelWaktu(p())).toBe("Setiap hari · Sepanjang hari");
  expect(jamLegacy([{ mulai: "07:00", selesai: "10:00" }])).toEqual({ jam_mulai: "07:00", jam_selesai: "10:00" });
  expect(jamLegacy([{ mulai: "00:00", selesai: "23:59" }])).toEqual({ jam_mulai: "00:00", jam_selesai: "23:59:59" });
  expect(jamLegacy([{ mulai: "21:00", selesai: "01:00" }])).toEqual({ jam_mulai: "00:00", jam_selesai: "23:59:59" });
  expect(hargaPromo(22000, "persen", 20)).toBe(17600);
  expect(hargaPromo(22000, "harga_akhir", 15000)).toBe(15000);
  expect(hargaPromo(22000, "potongan", 5000)).toBe(17000);
  expect(hargaPromo(22000, "gratis", 100)).toBe(0);
  expect(hitungMundur(5075_000)).toBe("01:24:35");
});

it("bagi unit promo per baris sesuai urutan keranjang", async () => {
  const { bagiPromo, pesanKuotaSebagian } = await import("../promo-tampilan");
  const lines = [
    { menu_id: "kopi", qty: 2, layak: true },
    { menu_id: "ame", qty: 1, layak: true },
    { menu_id: "kopi", qty: 2, layak: true },
    { menu_id: "roti", qty: 1, layak: false },
  ];
  expect(bagiPromo(lines, { kopi: 3, ame: 1 })).toEqual([{ promo: 2, normal: 0 }, { promo: 1, normal: 0 }, { promo: 1, normal: 1 }, { promo: 0, normal: 1 }]);
  expect(bagiPromo(lines, null).map((x) => x.promo)).toEqual([0, 0, 0, 0]);
  expect(pesanKuotaSebagian({ kopi: 3 }, { kopi: 1 })).toBe("Kuota tinggal 3 — 3 item dapat promo, 1 item harga normal.");
  expect(pesanKuotaSebagian({ kopi: 4 }, {})).toBe("");
});

it("menampilkan syarat NGOPAG dan harga satu item setelah batas transaksi",()=>{
 const ng=p({minimum_belanja:25000,dasar_minimum:'keranjang',batas_diskon:5000,kanal_ids:['langsung','ruma_app']});
 expect(syaratPromo(ng)).toContain('Min. total belanja');expect(syaratPromo(ng)).toContain('per transaksi');
 expect(hargaPromoDenganBatas(28000,'persen',20,5000)).toBe(23000);
 expect(hargaPromoDenganBatas(56000,'persen',20,5000)).toBe(51000);
 expect(kanalPromoBoleh(ng,'ruma_app')).toBe(true);expect(kanalPromoBoleh(ng,'grabfood')).toBe(false);
 expect(kanalPromoBoleh(p(),'grabfood')).toBe(true);
});
