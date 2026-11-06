import { describe, expect, it } from "vitest";
import { janggal, kolomBayar, rincianDariPembayaran } from "../harian";

// Transaksi janggal asli Kominot 5 Nov 2026 (PDF revisi akunting) + contoh normal.
const t5 = (kanal: string, metode: string, nominal: number) => ({ kanal, tanggal: "2026-11-05", bayar: [{ metode, nominal }] });

describe("Catatan Harian = rincian Penjualan POS (mulai 5 Nov)", () => {
  it("kolom uang mengikuti metode bayar; tumbler = wadah", () => {
    expect(kolomBayar("tumbler", "qris", "2026-11-05")).toBe("non_tunai");
    expect(kolomBayar("tumbler", "tunai", "2026-11-06")).toBe("tunai");
    expect(kolomBayar("grabfood", "qris", "2026-11-05")).toBe("non_tunai");
    expect(kolomBayar("ruma_app", "tunai", "2026-11-05")).toBe("tunai");
    expect(kolomBayar("ruma_app", "ruma_app", "2026-11-05")).toBe("ruma_app");
    expect(kolomBayar("langsung", "grabfood", "2026-11-05")).toBe("grabfood");
    expect(kolomBayar("langsung", "debit", "2026-12-01")).toBe("non_tunai");
  });
  it("1–4 Nov tetap per kanal (data yang sudah direkonsiliasi tidak berubah)", () => {
    expect(kolomBayar("gofood", "qris", "2026-11-02")).toBe("gofood");
    expect(kolomBayar("langsung", "qris", "2026-11-04")).toBe("non_tunai");
  });
  it("rincian per kolom = jumlah per metode (setiap rupiah masuk tepat satu kolom)", () => {
    const trx = [t5("grabfood", "qris", 24000), t5("tumbler", "qris", 23000), t5("ruma_app", "qris", 151000 - 5000), t5("ruma_app", "tunai", 5000),
      t5("ruma_app", "ruma_app", 56000), t5("grabfood", "grabfood", 255000), t5("langsung", "tunai", 787000), t5("langsung", "qris", 1388000)];
    const r = rincianDariPembayaran(trx);
    const perMetode: Record<string, number> = {};
    for (const t of trx) for (const b of t.bayar) { const k = b.metode === "qris" ? "non_tunai" : b.metode; perMetode[k] = (perMetode[k] ?? 0) + b.nominal; }
    expect(r).toEqual(perMetode);
    expect(r).toMatchObject({ tunai: 792000, non_tunai: 1581000, grabfood: 255000, ruma_app: 56000 });
    expect(Object.values(r).reduce((a, b) => a + b, 0)).toBe(trx.reduce((a, t) => a + t.bayar[0].nominal, 0));
  });
  it("tanda janggal hanya info", () => {
    expect(janggal("grabfood", "qris")).toBe(true);
    expect(janggal("tumbler", "qris")).toBe(false);
    expect(janggal("langsung", "tunai")).toBe(false);
  });
});

describe("diskon mulai 5 Nov", () => {
  it("kolom uang memakai nominal bayar sesudah diskon, jumlahnya = uang masuk per metode", () => {
    // subtotal 50.000, diskon 10.000 → dibayar QRIS 40.000; Catatan Harian non_tunai harus 40.000 (bukan 50.000)
    const r = rincianDariPembayaran([{ kanal: "langsung", tanggal: "2026-11-07", bayar: [{ metode: "qris", nominal: 40000 }] }]);
    expect(r).toEqual({ non_tunai: 40000 });
  });
});
