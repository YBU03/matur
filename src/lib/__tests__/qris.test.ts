import { describe, expect, it } from "vitest";
import { cekQris, crc16, parseTlv, qrisDinamis } from "../qris";

const tlv = (tag: string, v: string) => tag + String(v.length).padStart(2, "0") + v;
const tanpaCrc =
  tlv("00", "01") + tlv("01", "11") +
  tlv("26", tlv("00", "ID.DANA.WWW") + tlv("01", "936009153000000000") + tlv("02", "000000000000000") + tlv("03", "UMI")) +
  tlv("51", tlv("00", "ID.CO.QRIS.WWW") + tlv("02", "ID1020000000001") + tlv("03", "UMI")) +
  tlv("52", "5812") + tlv("53", "360") + tlv("58", "ID") + tlv("59", "RUMA KOPIAKSA") + tlv("60", "PURBALINGGA") + tlv("61", "53311") + tlv("62", tlv("07", "A01"));
const STATIS = tanpaCrc + "6304" + crc16(tanpaCrc + "6304");

describe("crc16", () => {
  it("cocok dengan vektor uji CCITT-FALSE", () => expect(crc16("123456789")).toBe("29B1"));
});

describe("QRIS", () => {
  it("membaca QRIS statis", () => {
    const i = cekQris(STATIS);
    expect(i).toMatchObject({ valid: true, dinamis: false, merchant: "RUMA KOPIAKSA", kota: "PURBALINGGA", nmid: "ID1020000000001" });
  });
  it("menolak CRC salah & bukan QRIS", () => {
    expect(cekQris(STATIS.slice(0, -1) + "0").valid).toBe(false);
    expect(cekQris("https://contoh.id").valid).toBe(false);
  });
  it("membuat QRIS dinamis bernominal dengan CRC valid", () => {
    const d = qrisDinamis(STATIS, 48000);
    const t = parseTlv(d);
    expect(t.find((x) => x.tag === "01")?.nilai).toBe("12");
    expect(t.find((x) => x.tag === "54")?.nilai).toBe("48000");
    expect(t.findIndex((x) => x.tag === "54")).toBe(t.findIndex((x) => x.tag === "58") - 1);
    expect(cekQris(d)).toMatchObject({ valid: true, dinamis: true, merchant: "RUMA KOPIAKSA" });
    // nominal lama diganti, bukan ditumpuk
    expect(parseTlv(qrisDinamis(d, 15000)).filter((x) => x.tag === "54")).toEqual([{ tag: "54", nilai: "15000" }]);
  });
  it("menolak nominal nol", () => expect(() => qrisDinamis(STATIS, 0)).toThrow());
});
