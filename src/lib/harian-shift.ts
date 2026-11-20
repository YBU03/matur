import { tglOperasional } from "./hari-operasional";
export type ShiftHarian = {
  id: string;
  tanggal_catatan?: string;
  tanggal_terkait?: string[] | null;
  tanggal_valid?: string[] | null;
  tanggal_shift?: string | null;
  dibuka_at: string;
  ditutup_at: string | null;
};
export function tanggalShift(s: ShiftHarian) {
  return s.tanggal_terkait?.length
    ? s.tanggal_terkait
    : [s.tanggal_catatan ?? s.tanggal_shift ?? tglOperasional(s.dibuka_at)];
}
export function sesiPadaHari<T extends ShiftHarian>(
  sesi: T[],
  tanggal: string,
) {
  return sesi.filter((s) =>
    (s.tanggal_valid ?? tanggalShift(s)).includes(tanggal),
  );
}
export function biayaBelumTerhubung(
  b: { sumber: string; tanggal: string; sesi_kas_id?: string | null },
  sesi: ShiftHarian[],
) {
  return (
    b.sumber === "laci" &&
    (!b.sesi_kas_id ||
      !sesi.some(
        (s) =>
          s.id === b.sesi_kas_id &&
          (s.tanggal_valid ?? tanggalShift(s)).includes(b.tanggal),
      ))
  );
}
