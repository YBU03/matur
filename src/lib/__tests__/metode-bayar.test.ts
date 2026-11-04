import { expect, it } from "vitest";
import { METODE_PLATFORM, LABEL_METODE_BAYAR, saranMetodeKanal } from "../metode-bayar";
import { susunBarisStruk, STRUK_BAWAAN } from "../struk";
it("suggests platform by channel and lets manual direct methods remain on direct orders", () => {
  for (const [kode] of METODE_PLATFORM) {
    expect(saranMetodeKanal(kode, "tunai")).toBe(kode);
    expect(saranMetodeKanal("langsung", kode)).toBe("tunai");
  }
  expect(saranMetodeKanal("langsung", "transfer")).toBe("transfer");
  expect(saranMetodeKanal("tumbler", "qris")).toBe("qris");
});
it("prints platform tender labels while preserving historical Shopee-Pay", () => {
  expect(LABEL_METODE_BAYAR.shopeepay).toBe("Shopee-Pay");
  for (const [metode, nama] of METODE_PLATFORM) {
    const baris = susunBarisStruk({struk: STRUK_BAWAAN, waktu: new Date("2026-11-04T01:00:00Z"), nomor:1, kanal:metode,kasir:"Uji",items:[{nama:"Kopi",qty:1,total:23000}],subtotal:23000,diskon:0,total:23000,bayar:[{metode,nominal:23000}],kembalian:0}, 32);
    expect(baris.some(b => typeof b !== "string" && b.kiriKanan?.[0] === "  " + nama)).toBe(true);
  }
});
