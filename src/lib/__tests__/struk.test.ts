import { describe, expect, it } from "vitest";
import { barisTeks } from "../struk-pdf";
import { STRUK_BAWAAN, angkaStruk, nomorOrder, susunBarisStruk, tanggalStruk } from "../struk";

const waktu = new Date("2026-11-01T01:33:00Z"); // 08:33 WIB
const dasar = {
  struk: { ...STRUK_BAWAAN, alamat: "Jl. Komisaris Noto Sumarsono No.23, Purbalingga Kidul", telepon: "085869288356" },
  waktu,
  nomor: 3,
  kanal: "langsung",
  kasir: "Maya",
  items: [
    { nama: "Mochaccino", qty: 1, total: 24000 },
    { nama: "Iced Kopi Susu Keluarga", qty: 2, total: 46000 },
  ],
  subtotal: 70000,
  diskon: 0,
  total: 70000,
  bayar: [{ metode: "qris", nominal: 70000 }],
  kembalian: 0,
};
const teks = (d: Parameters<typeof susunBarisStruk>[0]) => barisTeks(susunBarisStruk(d, 32), 32).map((b) => b.teks);

describe("struk format Ruma", () => {
  it("format angka, tanggal WIB & nomor order", () => {
    expect(angkaStruk(24000)).toBe("24.000");
    expect(tanggalStruk(waktu)).toBe("01/11/2026 08:33");
    expect(nomorOrder(waktu, 3)).toBe("POS-011126-3");
  });

  it("susunan kepala, item, total, tender, kaki", () => {
    const t = teks(dasar);
    expect(t[0]).toBe("RUMA");
    expect(t).toContain("Phone: 085869288356");
    expect(t).toContain("Order Number : POS-011126-3");
    expect(t).toContain("Sales Type   : Normal");
    expect(t).toContain("Cashier      : Maya");
    expect(t).toContain("Mochaccino");
    expect(t.find((x) => x.startsWith("2x 23.000"))).toMatch(/46\.000$/);
    expect(t).toContain("Total Item 3");
    expect(t.find((x) => x.startsWith("  Qris"))).toMatch(/70\.000$/);
    expect(t.find((x) => x.startsWith("Change"))).toMatch(/ 0$/);
    expect(t).toContain("instagram: di.rumakopi");
    expect(t).toContain("password wifi : keluargaruma");
    expect(t).toContain("tempat ngopi, tempat pulang");
    expect(t[t.length - 1]).toBe("#RUMAKOPI");
    expect(t.every((x) => x.length <= 32)).toBe(true);
    expect(t).not.toContain("** REPRINT BILL **");
  });

  it("tunai: tender = uang diterima, change = kembalian; reprint & void ditandai", () => {
    const t = teks({ ...dasar, bayar: [{ metode: "tunai", nominal: 70000, diterima: 100000 }], kembalian: 30000, cetakUlang: true });
    expect(t.find((x) => x.startsWith("  Tunai"))).toMatch(/100\.000$/);
    expect(t.find((x) => x.startsWith("Change"))).toMatch(/30\.000$/);
    expect(t).toContain("** REPRINT BILL **");
    const v = teks({ ...dasar, cetakUlang: true, voidAlasan: "salah input" });
    expect(v).toContain("** VOID BILL **");
    expect(v).not.toContain("** REPRINT BILL **");
  });

  it("isian kosong tidak dicetak", () => {
    const t = teks({ ...dasar, struk: { ...dasar.struk, alamat: "", telepon: "", instagram: "", wifi: "", catatan: "Terima kasih\nSampai jumpa" } });
    expect(t.some((x) => x.startsWith("Phone"))).toBe(false);
    expect(t.some((x) => x.startsWith("instagram"))).toBe(false);
    expect(t.some((x) => x.includes("wifi"))).toBe(false);
    expect(t.slice(-2)).toEqual(["Terima kasih", "Sampai jumpa"]);
  });
});
