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

import { infoJalur, jalurBerikut, simpanJalur, putusPrinter } from "../printer-bt";

describe("pemilihan jalur cetak (RPP02N dengan beberapa jalur tulis)", () => {
  const buatPrinter = (id: string) => {
    const masuk: Record<string, number> = { cfg: 0, cetak: 0, lain: 0 };
    const ch = (uuid: string, kunci: string) => ({ uuid, properties: { write: true, writeWithoutResponse: false }, writeValueWithResponse: async (d: Uint8Array) => void (masuk[kunci] += d.length) });
    const gatt = {
      connected: true,
      putus: 0,
      connect: async () => ((gatt.connected = true), gatt),
      disconnect: () => ((gatt.connected = false), gatt.putus++),
      // jalur pengaturan vendor muncul PERTAMA, jalur cetak 2AF1 kedua
      getPrimaryServices: async () => [
        { uuid: "0000ff00-0000-1000-8000-00805f9b34fb", getCharacteristics: async () => [ch("0000ff99-0000-1000-8000-00805f9b34fb", "cfg")] },
        { uuid: "000018f0-0000-1000-8000-00805f9b34fb", getCharacteristics: async () => [ch("00002af1-0000-1000-8000-00805f9b34fb", "cetak")] },
        { uuid: "0000abcd-0000-1000-8000-00805f9b34fb", getCharacteristics: async () => [ch("0000abce-0000-1000-8000-00805f9b34fb", "lain")] },
      ],
    };
    return { dev: { id, name: "RPP02N", gatt, addEventListener: () => {} }, masuk, gatt };
  };

  it("memakai jalur cetak yang dikenal, bukan jalur tulis pertama", async () => {
    const p = buatPrinter("A");
    vi.stubGlobal("navigator", { userAgent: "Android", bluetooth: { requestDevice: async () => p.dev } });
    await sambungPrinter();
    expect(infoJalur()).toMatchObject({ ke: 1, total: 3, dikenal: true });
    await cetakBluetooth(strukTes(32));
    expect(p.masuk.cetak).toBeGreaterThan(0);
    expect(p.masuk.cfg).toBe(0);
    vi.unstubAllGlobals();
  });

  it("tes tidak keluar → coba jalur berikut, lalu diingat saat printer disambung lagi; ganti printer memutus yang lama", async () => {
    const simpan: Record<string, string> = {};
    vi.stubGlobal("localStorage", { getItem: (k: string) => simpan[k] ?? null, setItem: (k: string, v: string) => void (simpan[k] = v) });
    const a = buatPrinter("A");
    vi.stubGlobal("navigator", { userAgent: "Android", bluetooth: { requestDevice: async () => a.dev } });
    await sambungPrinter();
    jalurBerikut(); // 2AF1 → jalur lain
    expect(infoJalur()).toMatchObject({ ke: 2, dikenal: false });
    simpanJalur();
    const b = buatPrinter("B");
    vi.stubGlobal("navigator", { userAgent: "Android", bluetooth: { requestDevice: async () => b.dev } });
    await sambungPrinter();
    expect(a.gatt.putus).toBe(1);
    expect(infoJalur()).toMatchObject({ ke: 1, dikenal: true }); // printer B belum punya ingatan
    vi.stubGlobal("navigator", { userAgent: "Android", bluetooth: { requestDevice: async () => a.dev } });
    await sambungPrinter();
    expect(infoJalur()).toMatchObject({ ke: 2, tersimpan: true }); // printer A pakai jalur yang terbukti berhasil
    const sebelum = a.masuk.cfg;
    await cetakBluetooth(strukTes(32));
    expect(a.masuk.cfg).toBeGreaterThan(sebelum); // jalur ke-2 setelah diurutkan = jalur yang disimpan
    putusPrinter();
    vi.unstubAllGlobals();
  });
});

import { diAplikasi, daftarPrinterAplikasi } from "../printer-bt";

describe("aplikasi Android Matoer POS (window.MatoerAndroid)", () => {
  it("memakai printer bawaan aplikasi: nama dari pilihan, cetak lewat jembatan dengan balasan", async () => {
    const w: Record<string, unknown> = {};
    let diterima = "";
    w.MatoerAndroid = {
      versi: () => "1.0.0",
      daftarPrinter: () => JSON.stringify({ izin: true, ada: true, aktif: true, perangkat: [{ nama: "RPP02N", alamat: "AA:BB", tipe: "klasik" }] }),
      printerTerpilih: () => JSON.stringify({ alamat: "AA:BB", nama: "RPP02N" }),
      pilihPrinter: () => {},
      lupakanPrinter: () => {},
      simpanFile: () => "ok",
      cetak: (b64: string, id: string) => {
        diterima = b64;
        setTimeout(() => (w.__matoerCetak as (i: string, ok: boolean, p: string) => void)(id, true, "terkirim"), 5);
      },
    };
    vi.stubGlobal("window", w);
    expect(diAplikasi()).toBe(true);
    expect(namaPrinter()).toBe("RPP02N");
    expect(daftarPrinterAplikasi().perangkat).toHaveLength(1);
    expect(await sambungPrinter()).toBe("RPP02N");
    const data = strukTes(32);
    await cetakBluetooth(data);
    expect(Uint8Array.from(atob(diterima), (c) => c.charCodeAt(0))).toEqual(data);
    // gagal dari aplikasi diteruskan sebagai error berpesan
    (w.MatoerAndroid as { cetak: (b: string, id: string) => void }).cetak = (_b, id) => setTimeout(() => (w.__matoerCetak as (i: string, ok: boolean, p: string) => void)(id, false, "Bluetooth tablet mati"), 5);
    await expect(cetakBluetooth(data)).rejects.toThrow(/Bluetooth tablet mati/);
    vi.unstubAllGlobals();
  });
});
