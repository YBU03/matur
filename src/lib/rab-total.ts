/** harga_estimasi is already the line total; qty must never multiply it again. */
export function totalEstimasiRab(
  items: readonly { harga_estimasi: number }[],
): number {
  return items.reduce((total, item) => total + Number(item.harga_estimasi), 0);
}
