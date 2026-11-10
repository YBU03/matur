// Ambil potongan teks + posisi dari file PDF di browser (pdf.js). File tidak dikirim ke server.
// pdf.js dimuat dari /public (salinan pdfjs-dist versi tetap) karena bundel webpack Next merusak modulnya.
import type { ItemPdf } from "./laporan-pdf";

const VERSI = "5.4.624";
type PdfJs = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (o: { data: Uint8Array }) => { promise: Promise<{ numPages: number; getPage: (n: number) => Promise<{ getTextContent: () => Promise<{ items: { str?: string; transform?: number[] }[] }> }>; destroy: () => Promise<void> }> };
};

export async function bacaItemPdf(file: File): Promise<ItemPdf[]> {
  const url = `/pdfjs/${VERSI}/pdf.min.mjs`;
  const pdfjs = (await import(/* webpackIgnore: true */ url)) as PdfJs;
  pdfjs.GlobalWorkerOptions.workerSrc = `/pdfjs/${VERSI}/pdf.worker.min.mjs`;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const items: ItemPdf[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const tc = await (await doc.getPage(p)).getTextContent();
    for (const it of tc.items) if (it.str?.trim() && it.transform) items.push({ halaman: p, x: it.transform[4], y: it.transform[5], teks: it.str });
  }
  await doc.destroy();
  return items;
}
