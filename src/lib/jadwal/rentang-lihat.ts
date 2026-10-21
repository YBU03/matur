import {
  addDays,
  eachDate,
  hariIni,
  monthRange,
  shiftMonth,
  weekStart,
} from "./waktu";
export type JadwalLihatParams = {
  outlet?: string;
  mode?: string;
  tanggal?: string;
  bulan?: string;
};
const validDate = (s?: string) =>
  !!s &&
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  !Number.isNaN(Date.parse(s + "T00:00:00Z")) &&
  new Date(s + "T00:00:00Z").toISOString().slice(0, 10) === s;
export function rentangLihat(p: JadwalLihatParams, today = hariIni()) {
  const mode = p.mode === "minggu" || p.mode === "bulan" ? p.mode : "hari";
  const tanggal = validDate(p.tanggal) ? p.tanggal! : today;
  const bulan = /^\d{4}-(0[1-9]|1[0-2])$/.test(p.bulan ?? "")
    ? p.bulan!
    : tanggal.slice(0, 7);
  const start =
    mode === "bulan"
      ? monthRange(bulan).start
      : mode === "minggu"
        ? weekStart(tanggal)
        : tanggal;
  const end =
    mode === "bulan"
      ? monthRange(bulan).end
      : mode === "minggu"
        ? addDays(start, 6)
        : tanggal;
  const step = (n: number): Record<string, string> =>
    mode === "bulan"
      ? { bulan: shiftMonth(bulan, n) }
      : { tanggal: addDays(tanggal, mode === "minggu" ? n * 7 : n) };
  return {
    mode,
    tanggal,
    bulan,
    start,
    end,
    days: eachDate(start, end),
    prev: step(-1),
    next: step(1),
  };
}
