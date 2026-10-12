/** Perkecil foto (sering >5 MB dari HP) menjadi JPEG dengan sisi terpanjang `max` px, di browser. */
export async function compressImage(file: File, max = 1600, quality = 0.8): Promise<Blob> {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error("Gagal memproses foto"))), "image/jpeg", quality));
}
