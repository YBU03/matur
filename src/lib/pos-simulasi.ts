export type SimMenu = {
  id: string;
  nama: string;
  harga_langsung: number;
  harga_ojol: number;
  varian: { id: string; nama: string; tambahan_harga: number }[];
};
export type SimItem = { menu: string; qty: number; varian: string[] };
export function hitungSimulasi(
  menus: SimMenu[],
  items: SimItem[],
  ojol: boolean,
  diskon: number,
  diterima: number,
) {
  if (!items.length) throw new Error("Pilih menu terlebih dahulu.");
  if (
    !Number.isSafeInteger(diskon) ||
    diskon < 0 ||
    !Number.isSafeInteger(diterima) ||
    diterima < 0
  )
    throw new Error("Nominal tidak valid.");
  const lines = items.map((i) => {
    const m = menus.find((m) => m.id === i.menu);
    if (!m || !Number.isInteger(i.qty) || i.qty < 1 || i.qty > 999)
      throw new Error("Menu/jumlah tidak valid.");
    const variants = [...new Set(i.varian)].map((id) => {
      const v = m.varian.find((v) => v.id === id);
      if (!v) throw new Error("Varian tidak sesuai menu.");
      return v;
    });
    const harga =
      Number(ojol ? m.harga_ojol : m.harga_langsung) +
      variants.reduce((n, v) => n + Number(v.tambahan_harga), 0);
    return {
      nama:
        m.nama +
        (variants.length ? ` (${variants.map((v) => v.nama).join(", ")})` : ""),
      qty: i.qty,
      harga,
      total: harga * i.qty,
    };
  });
  const subtotal = lines.reduce((n, l) => n + l.total, 0);
  if (diskon > subtotal) throw new Error("Diskon melebihi subtotal.");
  const total = subtotal - diskon;
  if (diterima < total) throw new Error("Uang diterima kurang.");
  return { lines, subtotal, diskon, total, kembalian: diterima - total };
}
