import type { Kiriman, ItemKiriman } from "./kiriman";
import { isiDokumen, qtyInvoice, basisCocok } from "./gudang-dokumen-model";
export function ringkasInvoice(k: Kiriman, items: ItemKiriman[]) {
  const isi = isiDokumen(k, "invoice");
  let barang = 0,
    diskon = 0,
    pajak = 0,
    valid = basisCocok(k, items, isi);
  for (const i of items) {
    const b = Math.round(qtyInvoice(k, i) * Number(i.harga)),
      v = isi?.baris?.[i.id];
    const d = Number(v?.diskon ?? 0),
      p = Number(v?.pajak ?? 0);
    if (
      !Number.isSafeInteger(d) ||
      !Number.isSafeInteger(p) ||
      d < 0 ||
      p < 0 ||
      d > b ||
      p > 1e12
    )
      valid = false;
    barang += b;
    diskon += d;
    pajak += p;
  }
  const penyesuaian = Number(k.penyesuaian?.nilai ?? 0),
    total = barang - diskon + pajak + penyesuaian;
  return {
    barang,
    diskon,
    pajak,
    penyesuaian,
    total,
    valid: valid && total >= 0,
  };
}
