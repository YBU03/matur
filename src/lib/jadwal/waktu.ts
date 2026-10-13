// Utilitas tanggal (YYYY-MM-DD) & jam shift WIB untuk jadwal. Diambil dari mesin jadwal Makaryo.

const TIMEZONE = "Asia/Jakarta";

/** Bulan berjalan menurut WIB dalam format YYYY-MM. */
export function currentMonth() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, year: "numeric", month: "2-digit" })
    .format(new Date())
    .slice(0, 7);
}

/** Rentang tanggal (inklusif) untuk satu bulan YYYY-MM. */
export function monthRange(month: string) {
  const [yearPart, monthPart] = month.split("-");
  const year = Number(yearPart);
  const monthIndex = Number(monthPart) - 1;

  if (!Number.isInteger(year) || !Number.isInteger(monthIndex)) return monthRange(currentMonth());

  const start = new Date(Date.UTC(year, monthIndex, 1));
  const end = new Date(Date.UTC(year, monthIndex + 1, 0));

  return { start: toIsoDate(start), end: toIsoDate(end) };
}

/** Daftar bulan terakhir untuk dropdown filter, terbaru lebih dulu. */
export function recentMonths(count = 12) {
  const [year, month] = currentMonth().split("-").map(Number);
  const months: { value: string; label: string }[] = [];

  for (let index = 0; index < count; index += 1) {
    const date = new Date(Date.UTC(year, month - 1 - index, 1));
    const value = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    months.push({
      value,
      label: new Intl.DateTimeFormat("id-ID", { timeZone: "UTC", month: "long", year: "numeric" }).format(date),
    });
  }

  return months;
}

/** Menggeser bulan `YYYY-MM` sejauh `delta` bulan. */
export function shiftMonth(month: string, delta: number) {
  const [year, monthPart] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthPart - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Pilihan bulan untuk penyaring atau formulir.
 *
 * `recentMonths` hanya melihat ke belakang, padahal jadwal biasanya disusun
 * untuk bulan depan. Fungsi ini bisa memuat bulan mendatang, dan `include`
 * memastikan bulan yang sedang dibuka selalu ada di daftar walau berada di
 * luar rentang — tanpa itu, `select` diam-diam jatuh ke pilihan pertama dan
 * aksinya mengenai bulan yang salah.
 */
export function monthOptions({
  back = 12,
  forward = 0,
  include,
}: { back?: number; forward?: number; include?: string } = {}) {
  const [year, month] = currentMonth().split("-").map(Number);
  const values: string[] = [];

  for (let index = forward; index >= -back; index -= 1) {
    const date = new Date(Date.UTC(year, month - 1 + index, 1));
    values.push(`${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`);
  }

  if (include && /^\d{4}-\d{2}$/.test(include) && !values.includes(include)) {
    values.push(include);
    values.sort().reverse();
  }

  return values.map((value) => ({ value, label: monthLabel(value) }));
}

export function monthLabel(month: string) {
  const { start } = monthRange(month);
  return new Intl.DateTimeFormat("id-ID", { timeZone: "UTC", month: "long", year: "numeric" }).format(
    new Date(`${start}T00:00:00Z`),
  );
}

/** Seluruh tanggal dalam rentang inklusif, sebagai YYYY-MM-DD. */
export function eachDate(start: string, end: string) {
  const dates: string[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);

  while (cursor.getTime() <= last.getTime()) {
    dates.push(toIsoDate(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

/** Indeks hari dalam minggu (0 = Senin) untuk tanggal YYYY-MM-DD. */
export function weekdayIndex(date: string) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return (day + 6) % 7;
}

/** Kunci minggu (tanggal Senin) untuk mengelompokkan jatah libur mingguan. */
export function weekStart(date: string) {
  const cursor = new Date(`${date}T00:00:00Z`);
  cursor.setUTCDate(cursor.getUTCDate() - weekdayIndex(date));
  return toIsoDate(cursor);
}

/** Selisih hari antara dua tanggal YYYY-MM-DD; negatif bila `date` mendahului `from`. */
export function daysBetween(from: string, date: string) {
  const awal = Date.parse(`${from}T00:00:00Z`);
  const akhir = Date.parse(`${date}T00:00:00Z`);
  return Math.round((akhir - awal) / 86_400_000);
}

export type MonthWeek = {
  /** Nomor minggu di dalam bulan, mulai dari 1. */
  index: number;
  start: string;
  end: string;
};

/**
 * Membagi satu bulan menjadi minggu-minggu Senin–Minggu, dipotong di tepi bulan.
 *
 * Potongan di tepi memang disengaja: penomorannya harus cocok dengan baris yang
 * dilihat admin di kalender, dan generate per bulan tidak boleh diam-diam
 * merembet ke bulan sebelah. Jadi minggu pertama dan terakhir bisa lebih pendek
 * dari tujuh hari.
 */
export function monthWeeks(month: string): MonthWeek[] {
  const { start, end } = monthRange(month);
  const weeks: MonthWeek[] = [];

  let cursor = start;
  while (cursor <= end) {
    const akhirMinggu = addDays(weekStart(cursor), 6);
    const akhir = akhirMinggu > end ? end : akhirMinggu;
    weeks.push({ index: weeks.length + 1, start: cursor, end: akhir });
    cursor = addDays(akhir, 1);
  }

  return weeks;
}

export function addDays(date: string, days: number) {
  const cursor = new Date(`${date}T00:00:00Z`);
  cursor.setUTCDate(cursor.getUTCDate() + days);
  return toIsoDate(cursor);
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export const WEEKDAY_LABELS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];


/**
 * Jam shift disimpan sebagai waktu lokal WIB (UTC+7, tanpa DST),
 * jadi konversi ke instant absolut cukup dengan menempelkan offset +07:00.
 */
const WIB_OFFSET = "+07:00";

function normalizeTime(time: string) {
  const [hour = "00", minute = "00"] = time.split(":");
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}:00`;
}

export function shiftStartInstant(workDate: string, startTime: string) {
  return new Date(`${workDate}T${normalizeTime(startTime)}${WIB_OFFSET}`);
}

/** Shift yang jam selesainya <= jam mulai dianggap berakhir keesokan harinya. */
export function shiftEndInstant(workDate: string, startTime: string, endTime: string) {
  const start = shiftStartInstant(workDate, startTime);
  const end = new Date(`${workDate}T${normalizeTime(endTime)}${WIB_OFFSET}`);
  if (end.getTime() <= start.getTime()) end.setUTCDate(end.getUTCDate() + 1);
  return end;
}

export function shiftDurationMinutes(startTime: string, endTime: string) {
  const start = shiftStartInstant("2000-01-01", startTime);
  const end = shiftEndInstant("2000-01-01", startTime, endTime);
  return Math.round((end.getTime() - start.getTime()) / 60_000);
}

/** Tanggal hari ini menurut WIB, YYYY-MM-DD. */
export function hariIni() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(new Date());
}
