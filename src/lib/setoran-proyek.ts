import { formatSaldoProyek } from "./format-saldo-proyek";

/** Kewajiban setoran memakai seluruh RAB, terlepas dari siapa pembeli barang. */
export function ringkasanSetoranMitra(rab: number, danaMasuk: number) {
  const selisih = rab - danaMasuk;
  const sisa = Math.max(0, selisih);
  const lebih = Math.max(0, -selisih);
  const keterangan = lebih > 0
    ? `Kelebihan setoran ${formatSaldoProyek(lebih)}`
    : sisa === 0 ? "Setoran terpenuhi" : "Grand Total RAB dikurangi dana masuk mitra";
  return { sisa, lebih, keterangan };
}

export function barisSetoranMitra(rab: number, danaMasuk: number): string[][] {
  const r = ringkasanSetoranMitra(rab, danaMasuk);
  return [["Sisa Setoran Mitra", formatSaldoProyek(r.sisa)], ["Status setoran mitra", r.keterangan]];
}
