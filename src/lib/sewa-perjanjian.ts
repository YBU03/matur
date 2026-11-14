/** Nilai tahunan adalah acuan; data lama tanpa kolom tahunan tetap terbaca. */
export type SewaPerjanjian = { sewa_tahunan?: number | string | null; sewa_bulanan?: number | string | null };
export function sewaTahunan(p: SewaPerjanjian): number {
  return p.sewa_tahunan != null ? Number(p.sewa_tahunan) : Number(p.sewa_bulanan ?? 0) * 12;
}
export function sewaBulanan(p: SewaPerjanjian): number {
  return sewaTahunan(p) / 12;
}
/** Laporan keuangan lama memakai rupiah bulat, bukan string uang desimal. */
export function sewaBulananLaporan(p: SewaPerjanjian): number {
  return Math.round(sewaBulanan(p));
}
export function formatSewaBulanan(tahunan: number): string {
  return `Rp ${new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(tahunan / 12)}`;
}
