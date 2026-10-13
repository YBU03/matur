import { describe, expect, it, vi } from "vitest";
import { asciiSaja, cetakBluetooth, namaPrinter, sambungPrinter, strukTes, susunStruk } from "../printer-bt";

/** buang perintah ESC/POS, ambil baris teks yang tercetak */
function teks(b: Uint8Array) {
  const out: number[] = [];
  for (let i = 0; i < b.length; i++) {
    const c = b[i];
    if (c === 0x1b) i += c === 0x1b && b[i + 1] === 0x40 ? 1 : 2; // ESC @ / ESC a n / ESC E n
    else if (c === 0x1d) i += b[i + 1] === 0x56 ? 3 : 2; // GS V m n / GS ! n
    else out.push(c);
  }
  return String.fromCharCode(...out).split("\n").filter((l) => l.length);
}

describe("susunStruk", () => {
  it("harga rata kanan tepat di kolom terakhir (58 mm = 32 kolom)", () => {
    const l = teks(susunStruk([{ teks: "", kiriKanan: ["2x Americano", "Rp 30.000"] }], 32));
    expect(l[0]).toHaveLength(32);
    expect(l[0].endsWith("Rp 30.000")).toBe(true);
  });
  it("nama menu panjang dilipat ke baris berikutnya tanpa menimpa harga", () => {
    const l = teks(susunStruk([{ teks: "", kiriKanan: ["1x Kopi Susu Keluarga Gula Aren (Less ice, Extra shot)", "Rp 18.000"] }], 32));
    expect(l.length).toBeGreaterThan(1);
    expect(l[0].endsWith("Rp 18.000")).toBe(true);
    expect(l.every((x) => x.length <= 32)).toBe(true);
  });
  it("hanya ASCII yang dikirim ke printer", () => {
    expect(asciiSaja("Terima kasih 🙏 · 2×")).toBe("Terima kasih   2x");
    const b = strukTes(48);
    expect([...b].every((c) => c < 0x80)).toBe(true);
    expect(teks(b).some((x) => x.includes("Tes printer berhasil"))).toBe(true);
  });
});

describe("cetakBluetooth (printer tiruan)", () => {
  it("menyambung, mengirim per ≤20 byte, dan menyambung ulang bila terputus", async () => {
    const terkirim: number[][] = [];
    const ch = { properties: { write: false, writeWithoutResponse: true }, writeValueWithoutResponse: async (d: Uint8Array) => void terkirim.push([...d]) };
    const gatt = { connected: true, connect: async () => ((gatt.connected = true), gatt), getPrimaryServices: async () => [{ getCharacteristics: async () => [ch] }] };
    vi.stubGlobal("navigator", { userAgent: "Android", bluetooth: { requestDevice: async () => ({ name: "RPP02N", gatt, addEventListener: () => {} }) } });

    expect(await sambungPrinter()).toBe("RPP02N");
    expect(namaPrinter()).toBe("RPP02N");
    const data = strukTes(32);
    await cetakBluetooth(data);
    expect(terkirim.every((p) => p.length <= 20)).toBe(true);
    expect(terkirim.flat()).toEqual([...data]);

    gatt.connected = false; // printer mati sebentar
    terkirim.length = 0;
    await cetakBluetooth(data);
    expect(gatt.connected).toBe(true);
    expect(terkirim.flat()).toHaveLength(data.length);
    vi.unstubAllGlobals();
  });
});
