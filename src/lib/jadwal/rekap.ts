// Rekap kehadiran: mencocokkan jadwal terbit dengan absensi & izin yang disetujui.
// Murni (tanpa database) supaya bisa diuji dan dipakai ulang untuk layar & ekspor.
import { shiftEndInstant } from "./waktu";

export type ShiftRingkas = { id: string; nama: string; jam_mulai: string; jam_selesai: string };
export type JadwalRingkas = { id: string; shift_id: string; pengguna_id: string; tanggal: string };
export type AbsenRingkas = {
  id: string;
  pengguna_id: string;
  jadwal_id: string | null;
  tanggal: string;
  masuk_at: string;
  pulang_at: string | null;
  status: "tepat" | "telat" | "tanpa_jadwal";
  telat_menit: number;
};
export type IzinRingkas = { pengguna_id: string; tanggal: string; jenis: "izin" | "libur" | "sakit" };

export type StatusHari = "tepat" | "telat" | "tanpa_jadwal" | "tidak_absen" | "belum" | "izin" | "libur" | "sakit";

export type BarisRekap = {
  pengguna_id: string;
  tanggal: string;
  shift?: ShiftRingkas;
  absen?: AbsenRingkas;
  status: StatusHari;
  menitKerja: number;
};

export type RingkasStaf = {
  pengguna_id: string;
  jadwal: number;
  hadir: number;
  tepat: number;
  telat: number;
  menitTelat: number;
  tidakAbsen: number;
  tanpaJadwal: number;
  izin: number;
  menitKerja: number;
};

export const LABEL_STATUS: Record<StatusHari, string> = {
  tepat: "Tepat waktu",
  telat: "Telat",
  tanpa_jadwal: "Masuk tanpa jadwal",
  tidak_absen: "Tidak absen",
  belum: "Belum mulai",
  izin: "Izin",
  libur: "Libur",
  sakit: "Sakit",
};

export const menitKerja = (a: { masuk_at: string; pulang_at: string | null }) =>
  a.pulang_at ? Math.max(0, Math.round((Date.parse(a.pulang_at) - Date.parse(a.masuk_at)) / 60_000)) : 0;

export function hitungRekap({
  shifts,
  jadwal,
  absensi,
  izin,
  sekarang = new Date(),
}: {
  shifts: ShiftRingkas[];
  jadwal: JadwalRingkas[];
  absensi: AbsenRingkas[];
  izin: IzinRingkas[];
  sekarang?: Date;
}) {
  const shiftById = new Map(shifts.map((s) => [s.id, s]));
  const absenByJadwal = new Map(absensi.filter((a) => a.jadwal_id).map((a) => [a.jadwal_id!, a]));
  const baris: BarisRekap[] = [];

  for (const j of jadwal) {
    const shift = shiftById.get(j.shift_id);
    const absen = absenByJadwal.get(j.id);
    let status: StatusHari;
    if (absen) status = absen.status === "telat" ? "telat" : "tepat";
    else if (shift && shiftEndInstant(j.tanggal, shift.jam_mulai, shift.jam_selesai) > sekarang) status = "belum";
    else status = "tidak_absen";
    baris.push({ pengguna_id: j.pengguna_id, tanggal: j.tanggal, shift, absen, status, menitKerja: absen ? menitKerja(absen) : 0 });
  }
  // absen yang tidak terikat jadwal (jadwalnya dihapus, atau masuk di luar jadwal)
  for (const a of absensi) {
    if (a.jadwal_id && jadwal.some((j) => j.id === a.jadwal_id)) continue;
    baris.push({ pengguna_id: a.pengguna_id, tanggal: a.tanggal, absen: a, status: a.status === "telat" ? "telat" : a.status === "tepat" ? "tepat" : "tanpa_jadwal", menitKerja: menitKerja(a) });
  }
  for (const i of izin) baris.push({ pengguna_id: i.pengguna_id, tanggal: i.tanggal, status: i.jenis, menitKerja: 0 });

  baris.sort((a, b) => a.tanggal.localeCompare(b.tanggal) || (a.shift?.jam_mulai ?? a.absen?.masuk_at ?? "").localeCompare(b.shift?.jam_mulai ?? b.absen?.masuk_at ?? ""));

  const ringkas = new Map<string, RingkasStaf>();
  const ambil = (id: string) => {
    let r = ringkas.get(id);
    if (!r) ringkas.set(id, (r = { pengguna_id: id, jadwal: 0, hadir: 0, tepat: 0, telat: 0, menitTelat: 0, tidakAbsen: 0, tanpaJadwal: 0, izin: 0, menitKerja: 0 }));
    return r;
  };
  for (const b of baris) {
    const r = ambil(b.pengguna_id);
    if (b.shift && b.status !== "belum") r.jadwal += 1;
    if (b.absen) {
      r.hadir += 1;
      r.menitKerja += b.menitKerja;
    }
    if (b.status === "tepat") r.tepat += 1;
    if (b.status === "telat") {
      r.telat += 1;
      r.menitTelat += b.absen?.telat_menit ?? 0;
    }
    if (b.status === "tanpa_jadwal") r.tanpaJadwal += 1;
    if (b.status === "tidak_absen") r.tidakAbsen += 1;
    if (b.status === "izin" || b.status === "sakit" || b.status === "libur") r.izin += 1;
  }
  return { baris, ringkas: [...ringkas.values()] };
}

export function formatDurasi(menit: number) {
  if (menit <= 0) return "0 jam";
  const j = Math.floor(menit / 60);
  const m = menit % 60;
  if (j === 0) return `${m} mnt`;
  return m ? `${j} j ${m} mnt` : `${j} jam`;
}
