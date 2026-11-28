/** Keterangan tampilan saja; tidak dipakai untuk parsing, konversi, atau penyimpanan. */
const angka = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 20 });
export const PETUNJUK_DESIMAL_BAHAN = "Koma menandai desimal: 0,7 gram berarti kurang dari 1 gram; 700 gram berarti tujuh ratus gram. Semua jumlah mengikuti satuan yang tertulis, bukan otomatis kemasan atau kilogram.";
export function jumlahBahanTertulis(jumlah: number, satuan: string) {
  if (!Number.isFinite(jumlah)) return "";
  const label = satuan === "g" ? "gram" : satuan;
  return `${angka.format(jumlah)} ${label || "(satuan belum diatur)"}`;
}
