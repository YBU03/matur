// Cetak struk langsung ke printer thermal Bluetooth (ESC/POS) lewat Web Bluetooth (Chrome Android/desktop).
// Fallback tetap tombol "Cetak" biasa (dialog print browser).

type Karakteristik = { writeValue: (d: BufferSource) => Promise<void>; properties: { write: boolean; writeWithoutResponse: boolean } };
type Perangkat = { name?: string; gatt?: { connected: boolean; connect: () => Promise<{ getPrimaryServices: () => Promise<{ getCharacteristics: () => Promise<Karakteristik[]> }[]> }> } };
type Bt = { requestDevice: (o: unknown) => Promise<Perangkat> };

// layanan umum printer thermal murah (58/80 mm)
const LAYANAN = ["000018f0-0000-1000-8000-00805f9b34fb", "0000ff00-0000-1000-8000-00805f9b34fb", "e7810a71-73ae-499d-8c15-faa9aef0c3f2", "49535343-fe7d-4ae5-8fa9-9fafd205e455"];

let printer: { nama: string; ch: Karakteristik } | null = null;

export const bisaBluetooth = () => typeof navigator !== "undefined" && "bluetooth" in navigator;
export const namaPrinter = () => printer?.nama ?? null;

export async function sambungPrinter() {
  const bt = (navigator as unknown as { bluetooth: Bt }).bluetooth;
  const dev = await bt.requestDevice({ acceptAllDevices: true, optionalServices: LAYANAN });
  const server = await dev.gatt!.connect();
  for (const sv of await server.getPrimaryServices()) {
    for (const ch of await sv.getCharacteristics()) {
      if (ch.properties.write || ch.properties.writeWithoutResponse) {
        printer = { nama: dev.name ?? "Printer", ch };
        return printer.nama;
      }
    }
  }
  throw new Error("Printer tidak punya jalur cetak yang dikenali.");
}

const ESC = 0x1b, GS = 0x1d;
/** Teks struk sederhana (ASCII) → byte ESC/POS. `lebar`: 32 kolom (58 mm) / 48 kolom (80 mm). */
export function susunStruk(baris: (string | { teks: string; tengah?: boolean; tebal?: boolean; kiriKanan?: [string, string] })[], lebar: number) {
  const out: number[] = [ESC, 0x40]; // init
  const tulis = (s: string) => {
    for (const c of s.normalize("NFKD").replace(/[^\x20-\x7e\n]/g, "")) out.push(c.charCodeAt(0));
  };
  for (const b of baris) {
    const o = typeof b === "string" ? { teks: b } : b;
    out.push(ESC, 0x61, o.tengah ? 1 : 0, ESC, 0x45, o.tebal ? 1 : 0);
    if (o.kiriKanan) {
      const [k, n] = o.kiriKanan;
      const ruang = Math.max(lebar - n.length, 1);
      const kiri = k.length > ruang - 1 ? k.slice(0, ruang - 1) : k;
      tulis(kiri + " ".repeat(Math.max(lebar - kiri.length - n.length, 1)) + n + "\n");
      if (k.length > ruang - 1) tulis("  " + k.slice(ruang - 1) + "\n");
    } else tulis(o.teks + "\n");
  }
  out.push(ESC, 0x61, 0, 0x0a, 0x0a, 0x0a, GS, 0x56, 0x42, 0x00); // feed + potong
  return new Uint8Array(out);
}

export async function cetakBluetooth(data: Uint8Array) {
  if (!printer) throw new Error("Printer belum tersambung.");
  for (let i = 0; i < data.length; i += 100) await printer.ch.writeValue(data.slice(i, i + 100));
}
