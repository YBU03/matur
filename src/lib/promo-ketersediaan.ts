import type { Promo } from "./promo";
import type { CartLine } from "./pos-actions";
import { akhirSlot } from "./promo-tampilan";

export type AlasanPromoNormal = "kuota" | "waktu";

/** Hanya snapshot tampilan; reservasi atomik server tetap menentukan harga resmi. */
export function alasanPromoNormal(
  p: Promo,
  items: CartLine[] = [],
  now = Date.now(),
): AlasanPromoNormal | null {
  if (
    !p.aktif ||
    (p.berakhir_at
      ? Date.parse(p.berakhir_at) <= now
      : akhirSlot(p, now) === null)
  )
    return "waktu";
  if (!p.kuota || !p.sisa_kuota) return null;
  const sisa = Object.values(p.sisa_kuota);
  if (sisa.length && sisa.every((n) => n <= 0)) return "kuota";
  const qty: Record<string, number> = {};
  for (const item of items) {
    if (
      !p.aturan.some(
        (a) =>
          a.menu_id === item.menu_id &&
          a.varian_ids.every((id) => item.varian_ids.includes(id)),
      )
    )
      continue;
    const key = p.per_menu ? item.menu_id : "semua";
    qty[key] = (qty[key] ?? 0) + item.qty;
  }
  if (p.cakupan === "transaksi" && Object.keys(qty).length) {
    return (p.sisa_kuota.semua ?? Infinity) < 1 ? "kuota" : null;
  }
  // Promo sebagian: tetap tersedia selama minimal satu item promo masih kebagian kuota;
  // item yang melebihi sisa kuota otomatis harga normal (dihitung server). "kuota" hanya bila semua habis.
  const keys = Object.keys(qty);
  return keys.length && keys.every((key) => (p.sisa_kuota![key] ?? Infinity) <= 0) ? "kuota" : null;
}

/** Jangan memperlakukan error koneksi, izin, atau harga sebagai kuota habis. */
export function alasanPromoDariError(error: string): AlasanPromoNormal | null {
  if (/^Kuota promo tidak cukup \(sisa \d+\)/.test(error)) return "kuota";
  if (
    error === "Promo tidak aktif untuk outlet/waktu ini" ||
    error === "Reservasi berakhir. Pilih promo kembali"
  )
    return "waktu";
  return null;
}

export function pesanHargaNormal(alasan: AlasanPromoNormal) {
  return alasan === "kuota"
    ? "Kuota promo habis atau tidak cukup untuk keranjang ini. Harga normal berlaku; penjualan tetap bisa dilanjutkan."
    : "Waktu promo atau reservasi telah berakhir. Harga normal berlaku. Periksa total sebelum melanjutkan; jika sudah membayar, cek riwayat dan dana masuk terlebih dahulu.";
}
