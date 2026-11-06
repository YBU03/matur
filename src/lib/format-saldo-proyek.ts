import { formatRupiah } from "./format";

/** Saldo proyek memakai tanda minus eksplisit, termasuk pada PDF dengan font standar. */
export function formatSaldoProyek(nilai: number): string {
  if (!nilai) return "Rp 0";
  return `${nilai < 0 ? "-" : ""}${formatRupiah(Math.abs(nilai))}`;
}
