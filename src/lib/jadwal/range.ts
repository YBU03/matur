import { addDays, daysBetween, monthRange, monthWeeks, weekStart } from "./waktu";

/**
 * Cakupan generate jadwal.
 *
 * Menyusun ulang satu bulan penuh itu palu godam: kalau yang salah hanya satu
 * minggu, seluruh bulan ikut diacak dan jadwal yang sudah benar jadi berubah.
 * Empat pilihan di bawah ini menutup kebutuhan sehari-hari — dari "lanjutkan
 * dari hari ini" sampai "perbaiki minggu ketiga saja".
 */
export type GenerateScope = "sisa-bulan" | "bulan" | "minggu-ini" | "minggu";

export type GenerateRange = {
  start: string;
  end: string;
  /** Jumlah hari dalam rentang, inklusif. */
  days: number;
};

export type ResolveInput = {
  month: string;
  scope: GenerateScope;
  /** Nomor minggu di dalam bulan, wajib untuk cakupan "minggu". */
  weekIndex?: number;
  today: string;
};

/**
 * Menerjemahkan pilihan cakupan menjadi rentang tanggal yang konkret.
 *
 * Mengembalikan `null` bila pilihannya tidak masuk akal untuk bulan itu —
 * misalnya "sisa bulan" pada bulan yang sudah lewat seluruhnya. Sisi tampilan
 * memakai ini untuk menyembunyikan pilihan yang mustahil, dan sisi server
 * memakainya lagi sebagai penjaga terakhir.
 */
export function resolveGenerateRange({
  month,
  scope,
  weekIndex,
  today,
}: ResolveInput): GenerateRange | null {
  const { start: monthStart, end: monthEnd } = monthRange(month);

  switch (scope) {
    case "bulan":
      return toRange(monthStart, monthEnd);

    // Titik mulainya hari ini, bukan tanggal 1 — hari yang sudah lewat punya
    // absensi yang tercatat, dan menyusun ulang jadwalnya tidak ada gunanya.
    case "sisa-bulan": {
      if (today > monthEnd) return null;
      return toRange(today > monthStart ? today : monthStart, monthEnd);
    }

    case "minggu-ini": {
      if (today < monthStart || today > monthEnd) return null;
      const akhirMinggu = addDays(weekStart(today), 6);
      return toRange(today, akhirMinggu > monthEnd ? monthEnd : akhirMinggu);
    }

    // Minggu tertentu diambil utuh, termasuk hari yang sudah lewat: ini justru
    // pintu untuk membetulkan minggu yang jadwalnya sudah terlanjur salah.
    case "minggu": {
      const minggu = monthWeeks(month).find((item) => item.index === weekIndex);
      return minggu ? toRange(minggu.start, minggu.end) : null;
    }

    default:
      return null;
  }
}

/** Cakupan bawaan: lanjutkan dari hari ini bila bulannya sedang berjalan. */
export function defaultScope(month: string, today: string): GenerateScope {
  const { start, end } = monthRange(month);
  return today >= start && today <= end ? "sisa-bulan" : "bulan";
}

function toRange(start: string, end: string): GenerateRange | null {
  if (start > end) return null;
  return { start, end, days: daysBetween(start, end) + 1 };
}
