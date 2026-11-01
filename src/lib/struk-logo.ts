// Logo struk → gambar 1-bit untuk printer thermal (dibuat sekali di browser lalu disimpan di memori).
import type { GambarStruk } from "./printer-bt";

const cache = new Map<string, Promise<GambarStruk | null>>();

/** Lebar titik printer: 58 mm ≈ 384 titik, 80 mm ≈ 576 titik; logo dibuat ±60% lebar kertas. */
export function logoStruk(kertas: "58" | "80", src = "/brand/ruma-logo.png"): Promise<GambarStruk | null> {
  const k = `${kertas}|${src}`;
  if (!cache.has(k)) cache.set(k, buat(kertas === "58" ? 232 : 344, src).catch(() => null));
  return cache.get(k)!;
}

async function buat(lebar: number, src: string): Promise<GambarStruk | null> {
  if (typeof document === "undefined") return null;
  const img = new Image();
  img.src = src;
  await img.decode();
  const w = Math.ceil(lebar / 8) * 8;
  const h = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * w));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h).data;
  const data = new Uint8Array((w / 8) * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const terang = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      if (terang < 150) data[y * (w / 8) + (x >> 3)] |= 0x80 >> (x & 7);
    }
  // pratinjau/PDF memakai versi hitam-putih yang sama dengan hasil cetak
  const out = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const hitam = data[y * (w / 8) + (x >> 3)] & (0x80 >> (x & 7));
      const i = (y * w + x) * 4;
      out.data[i] = out.data[i + 1] = out.data[i + 2] = hitam ? 0 : 255;
      out.data[i + 3] = 255;
    }
  ctx.putImageData(out, 0, 0);
  return { lebar: w, tinggi: h, data, dataUrl: c.toDataURL("image/png") };
}
