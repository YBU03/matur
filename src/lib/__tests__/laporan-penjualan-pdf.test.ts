import { describe, it, expect } from "vitest";
import {
  barisPenjualanPdf,
  buatLaporanPenjualanPdf,
  totalPenjualan,
} from "../laporan-penjualan-pdf";
import { rentangPreset } from "../laporan-pos";
const row = {
  waktu: "2026-10-31T17:09:00Z",
  nomor: 1,
  nomor_sumber: "009846",
  ref: "POS-011126-1",
  outlet: "Ruma Kopi Kominot",
  pelanggan: "Default Customer",
  item: "Iced Kopi Susu Keluarga",
  qty: 1,
  subtotal: 23000,
  diskon: 0,
  total: 23000,
  dibayar: 23000,
  sisa: 0,
  status: "lunas",
  metode: "tunai",
  metode_sumber: "Cash",
  sumber: "PDF",
};
describe("PDF penjualan", () => {
  it("preserves source numbers, WIB dates and original payment labels", () => {
    const r = barisPenjualanPdf(row);
    expect(r[0]).toContain("01/11/2026");
    expect(r[1]).toBe("009846");
    expect(r[3]).toBe("POS-011126-1");
    expect(r[17]).toBe("Cash");
  });
  it("does not invent a payment time for source dates and supports native payment labels", () => {
    const r = barisPenjualanPdf({
      ...row,
      nomor_sumber: null,
      metode_sumber: null,
      metode: "qris + tunai",
      terakhir_dibayar: "2026-11-01",
    });
    expect(r[1]).toBe("1");
    expect(r[14]).toBe("01/11/2026");
    expect(r[17]).toBe("QRIS + Tunai");
  });
  it("excludes void from financial totals without hiding its detail", () => {
    expect(
      totalPenjualan([row, { ...row, total: 90000, status: "void" }]),
    ).toMatchObject({ transaksi: 1, total: 23000, qty: 1, dibayar: 23000 });
  });
  it("handles relative dates across month boundaries", () => {
    expect(rentangPreset("kemarin", "2026-11-02")).toEqual([
      "2026-11-01",
      "2026-11-01",
    ]);
    expect(rentangPreset("bulan_lalu", "2026-11-02")).toEqual([
      "2026-10-01",
      "2026-10-31",
    ]);
  });
  it("builds a repeated-header PDF for long descriptions and multiple pages", async () => {
    const rows = Array.from({ length: 100 }, (_, i) => ({
      ...row,
      nomor_sumber: String(i),
      item: "Mochaccino, Black Coffe, Iced Kopi Susu Keluarga, Matcha Cookies, Lumpia Ayam",
    }));
    const doc = await buatLaporanPenjualanPdf({
      rows,
      outlet: "Kominot",
      dari: "2026-11-01",
      sampai: "2026-11-01",
    });
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
    expect(Math.round(doc.internal.pageSize.getWidth())).toBe(420);
    expect(doc.output()).toContain("MATOER");
  });
});
