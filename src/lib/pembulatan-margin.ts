import { marginLaba } from "./laporan-rekap";
export const CATATAN_MARGIN =
  "Selisih ini hanya akibat pembulatan persentase untuk tampilan. Tidak mengubah laba, saldo, atau pembagian hasil. Selisih total dihitung dari margin total, bukan penjumlahan selisih bulanan.";
/** Diagnostic only: never used to calculate ledger balances or source profit. */
export function pembulatanMargin(omzet: number, laba: number) {
  const asli = marginLaba(laba, omzet);
  if (asli === null)
    return { asli: null, tampilan: null, hitungBalik: null, selisih: null };
  // Match Intl rounding used by persenLaba, including negative midpoint values.
  const tampilan = Number(
    new Intl.NumberFormat("en-US", {
      useGrouping: false,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(asli),
  );
  const hitungBalik = (omzet * tampilan) / 100;
  const delta = hitungBalik - laba;
  return {
    asli,
    tampilan,
    hitungBalik,
    selisih: Math.abs(delta) < 1e-7 ? 0 : delta,
  };
}
export const marginPresisi = (v: number | null) =>
  v === null
    ? "—"
    : `≈ ${v.toLocaleString("id-ID", { maximumFractionDigits: 12 })}%`;
export const rupiahEfekMargin = (v: number | null) =>
  v === null
    ? "—"
    : new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(v || 0);
