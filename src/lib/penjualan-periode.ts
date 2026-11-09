/** Batasi tampilan tanggal grafik tanpa mengubah nominal atau mengelompokkan ulang data sumber. */
export function penjualanDalamPeriode<T extends { tgl: string }>(
  harian: readonly T[], dari: string, sampai: string,
): T[] {
  return harian.filter((h) => h.tgl >= dari && h.tgl <= sampai);
}
