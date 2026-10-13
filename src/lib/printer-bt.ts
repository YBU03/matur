// Cetak struk langsung ke printer thermal Bluetooth (ESC/POS).
// 1) Web Bluetooth (Chrome Android / Chrome desktop) untuk printer BLE.
// 2) Cadangan: aplikasi Android "RawBT" (printer Bluetooth klasik/SPP yang tidak bisa diakses browser).
// Fallback terakhir tetap tombol "Cetak" biasa (dialog print browser).

type Karakteristik = {
  properties: { write: boolean; writeWithoutResponse: boolean };
  writeValue?: (d: BufferSource) => Promise<void>;
  writeValueWithResponse?: (d: BufferSource) => Promise<void>;
  writeValueWithoutResponse?: (d: BufferSource) => Promise<void>;
};
type Gatt = { connected: boolean; connect: () => Promise<Gatt>; getPrimaryServices: () => Promise<{ getCharacteristics: () => Promise<Karakteristik[]> }[]> };
type Perangkat = { name?: string; gatt?: Gatt; addEventListener?: (t: string, f: () => void) => void };
type Bt = { requestDevice: (o: unknown) => Promise<Perangkat> };

// layanan umum printer thermal murah (58/80 mm): 18F0 (paling umum), FF00, FFE0 (HM-10), FEE7, AE30, ISSC, dsb.
const LAYANAN = [
  "000018f0-0000-1000-8000-00805f9b34fb",
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "0000ffe0-0000-1000-8000-00805f9b34fb",
  "0000fee7-0000-1000-8000-00805f9b34fb",
  "0000ae30-0000-1000-8000-00805f9b34fb",
  "0000af30-0000-1000-8000-00805f9b34fb",
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
];

let printer: { nama: string; dev: Perangkat; ch: Karakteristik } | null = null;

export const bisaBluetooth = () => typeof navigator !== "undefined" && "bluetooth" in navigator;
export const diAndroid = () => typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);
export const namaPrinter = () => printer?.nama ?? null;

async function cariKarakteristik(gatt: Gatt) {
  for (const sv of await gatt.getPrimaryServices()) {
    for (const ch of await sv.getCharacteristics()) if (ch.properties.write || ch.properties.writeWithoutResponse) return ch;
  }
  return null;
}

export async function sambungPrinter() {
  if (!bisaBluetooth()) throw new Error("Browser ini tidak mendukung Bluetooth. Pakai Chrome di Android, atau aplikasi RawBT.");
  const bt = (navigator as unknown as { bluetooth: Bt }).bluetooth;
  const dev = await bt.requestDevice({ acceptAllDevices: true, optionalServices: LAYANAN });
  const gatt = await dev.gatt!.connect();
  const ch = await cariKarakteristik(gatt);
  if (!ch) throw new Error("Printer tersambung tapi jalur cetaknya tidak dikenali. Kemungkinan printer Bluetooth klasik — pakai tombol RawBT.");
  printer = { nama: dev.name ?? "Printer", dev, ch };
  dev.addEventListener?.("gattserverdisconnected", () => {
    /* disambung ulang otomatis saat cetak berikutnya */
  });
  return printer.nama;
}

export function putusPrinter() {
  printer = null;
}

async function pastikanTersambung() {
  if (!printer) throw new Error("Printer belum tersambung.");
  if (!printer.dev.gatt?.connected) {
    const gatt = await printer.dev.gatt!.connect();
    const ch = await cariKarakteristik(gatt);
    if (!ch) throw new Error("Gagal menyambung ulang printer.");
    printer.ch = ch;
  }
  return printer.ch;
}

const ESC = 0x1b, GS = 0x1d;
export type BarisStruk = string | { teks: string; tengah?: boolean; tebal?: boolean; besar?: boolean; kiriKanan?: [string, string] };

/** Huruf non-ASCII diganti/dibuang (printer thermal murah hanya punya kode halaman dasar). */
export const asciiSaja = (s: string) =>
  s
    .replace(/[  ]/g, " ")
    .replace(/[–—−]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/×/g, "x")
    .normalize("NFKD")
    .replace(/[^\x20-\x7e\n]/g, "");

/** Pecah teks panjang menjadi beberapa baris selebar `lebar` kolom. */
function lipat(s: string, lebar: number) {
  const out: string[] = [];
  let sisa = s;
  while (sisa.length > lebar) {
    const potong = sisa.lastIndexOf(" ", lebar) > lebar / 2 ? sisa.lastIndexOf(" ", lebar) : lebar;
    out.push(sisa.slice(0, potong).trimEnd());
    sisa = sisa.slice(potong).trimStart();
  }
  out.push(sisa);
  return out;
}

/** Baris struk → byte ESC/POS. `lebar`: 32 kolom (58 mm) / 48 kolom (80 mm). */
export function susunStruk(baris: BarisStruk[], lebar: number) {
  const out: number[] = [ESC, 0x40]; // init
  const tulis = (s: string) => {
    for (const c of asciiSaja(s)) out.push(c.charCodeAt(0));
  };
  for (const b of baris) {
    const o = typeof b === "string" ? { teks: b } : b;
    out.push(ESC, 0x61, o.tengah ? 1 : 0, ESC, 0x45, o.tebal ? 1 : 0, GS, 0x21, o.besar ? 0x11 : 0x00);
    const kol = o.besar ? Math.floor(lebar / 2) : lebar;
    if (o.kiriKanan) {
      const k = asciiSaja(o.kiriKanan[0]);
      const n = asciiSaja(o.kiriKanan[1]);
      const ruangKiri = Math.max(kol - n.length - 1, 8);
      const kiri = lipat(k, ruangKiri);
      kiri.forEach((t, i) => tulis((i === 0 ? t + " ".repeat(Math.max(kol - t.length - n.length, 1)) + n : "  " + t) + "\n"));
    } else for (const t of lipat(asciiSaja(o.teks), kol)) tulis(t + "\n");
  }
  out.push(GS, 0x21, 0x00, ESC, 0x61, 0, 0x0a, 0x0a, 0x0a, GS, 0x56, 0x42, 0x00); // feed + potong (diabaikan printer tanpa pisau)
  return new Uint8Array(out);
}

const tunggu = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Kirim per 20 byte: batas aman BLE (MTU standar) untuk printer murah. */
export async function cetakBluetooth(data: Uint8Array) {
  const ch = await pastikanTersambung();
  const tanpaBalas = ch.properties.writeWithoutResponse && !ch.properties.write;
  for (let i = 0; i < data.length; i += 20) {
    const potong = data.slice(i, i + 20);
    if (tanpaBalas && ch.writeValueWithoutResponse) {
      await ch.writeValueWithoutResponse(potong);
      await tunggu(15);
    } else if (ch.writeValueWithResponse) await ch.writeValueWithResponse(potong);
    else await ch.writeValue!(potong);
  }
}

/** Cadangan Android: kirim byte ESC/POS ke aplikasi RawBT (gratis di Play Store), yang mencetak ke printer Bluetooth klasik. */
export function cetakRawBT(data: Uint8Array) {
  let bin = "";
  data.forEach((b) => (bin += String.fromCharCode(b)));
  window.location.href = `rawbt:base64,${btoa(bin)}`;
}

/** Struk uji untuk memastikan printer & lebar kertas benar. */
export function strukTes(lebar: number) {
  return susunStruk(
    [
      { teks: "MATOER", tengah: true, tebal: true, besar: true },
      { teks: "Tes printer berhasil", tengah: true },
      "-".repeat(lebar),
      { teks: "", kiriKanan: ["1x Kopi Susu Keluarga (Less ice)", "Rp 18.000"] },
      { teks: "", kiriKanan: ["2x Americano", "Rp 30.000"] },
      "-".repeat(lebar),
      { teks: "", tebal: true, kiriKanan: ["TOTAL", "Rp 48.000"] },
      "-".repeat(lebar),
      { teks: `Lebar ${lebar} kolom (${lebar === 32 ? "58" : "80"} mm)`, tengah: true },
    ],
    lebar,
  );
}
