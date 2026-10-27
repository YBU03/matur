import type { Kiriman, ItemKiriman } from "./kiriman";
export function ringkasInvoice(k: Kiriman, items: ItemKiriman[]) {
  const diperiksa =
    k.status === "diterima" ||
    k.pemeriksaan_status === "selisih" ||
    k.pemeriksaan_status === "selesai";
  const barang = items.reduce(
    (s, i) =>
      s +
      Math.round(
        Number(diperiksa && i.qty_diterima !== null ? i.qty_diterima : i.qty) *
          Number(i.harga),
      ),
    0,
  );
  const penyesuaian = Number(k.penyesuaian?.nilai ?? 0);
  return { barang, penyesuaian, total: barang + penyesuaian };
}
