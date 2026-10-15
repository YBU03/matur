// Hitung slip gaji dari komponen gaji staf + ringkasan absensi sebulan. Murni (bisa diuji, dipakai server & browser).

import { shiftEndInstant } from "./jadwal/waktu";
import type { BarisRekap } from "./jadwal/rekap";

export type Komponen = {
  aturan?: Partial<AturanGaji>;
  gaji_pokok: number;
  tunjangan: number;
  uang_makan: number;
  potongan_telat: number;
  potongan_alpa: number;
};
export type Baris = {
  nama: string;
  jumlah: number;
  manual?: boolean;
  kasbon?: boolean;
};
export type Kehadiran = {
  hadir: number;
  telat: number;
  menitTelat: number;
  tidakAbsen: number;
  izin: number;
  menitKerja: number;
};

export const KOMPONEN_KOSONG: Komponen = {
  gaji_pokok: 0,
  tunjangan: 0,
  uang_makan: 0,
  potongan_telat: 0,
  potongan_alpa: 0,
};

const bulat = (n: number) => Math.round(Number(n) || 0);
export const jumlahkan = (xs: Baris[]) =>
  xs.reduce((s, x) => s + bulat(x.jumlah), 0);

/** Baris otomatis dari komponen & kehadiran; baris tambahan (bonus, lembur, kasbon, dll.) disimpan terpisah oleh HRD. */
export function hitungSlip(k: Komponen, h: Kehadiran) {
  const pendapatan: Baris[] = [
    { nama: "Gaji pokok", jumlah: bulat(k.gaji_pokok) },
    { nama: "Tunjangan", jumlah: bulat(k.tunjangan) },
    {
      nama: `Uang makan (${h.hadir} hari hadir)`,
      jumlah: bulat(k.uang_makan) * h.hadir,
    },
  ].filter((b) => b.jumlah > 0);
  const potongan: Baris[] = [
    {
      nama: `Telat (${h.telat}×, ${h.menitTelat} menit)`,
      jumlah: bulat(k.potongan_telat) * h.telat,
    },
    {
      nama: `Tidak masuk tanpa izin (${h.tidakAbsen} hari)`,
      jumlah: bulat(k.potongan_alpa) * h.tidakAbsen,
    },
  ].filter((b) => b.jumlah > 0);
  return {
    pendapatan,
    potongan,
    total: Math.max(jumlahkan(pendapatan) - jumlahkan(potongan), 0),
  };
}

/** Total akhir slip setelah diedit (tidak pernah negatif). */
export const totalSlip = (pendapatan: Baris[], potongan: Baris[]) =>
  Math.max(jumlahkan(pendapatan) - jumlahkan(potongan), 0);

export type AturanGaji = {
  hari_pembagi: number;
  jam_normal: number;
  istirahat_menit: number;
  lembur_min_menit: number;
  lembur_mode: "seluruh" | "selisih";
  lembur_tarif: number;
  lembur_pengali: number;
  pembulatan_menit: number;
};
export const ATURAN_GAJI: AturanGaji = {
  hari_pembagi: 26,
  jam_normal: 8,
  istirahat_menit: 0,
  lembur_min_menit: 120,
  lembur_mode: "seluruh",
  lembur_tarif: 0,
  lembur_pengali: 1,
  pembulatan_menit: 1,
};
export function aturanGaji(raw?: Partial<AturanGaji>): AturanGaji {
  const a = { ...ATURAN_GAJI, ...raw };
  const ranges: {
    [K in Exclude<keyof AturanGaji, "lembur_mode">]: [number, number];
  } = {
    hari_pembagi: [1, 31],
    jam_normal: [1, 24],
    istirahat_menit: [0, 480],
    lembur_min_menit: [0, 1440],
    lembur_tarif: [0, 100000000],
    lembur_pengali: [0.1, 10],
    pembulatan_menit: [1, 120],
  };
  for (const [k, [lo, hi]] of Object.entries(ranges)) {
    const n = Number(a[k as keyof AturanGaji]);
    if (!Number.isFinite(n) || n < lo || n > hi)
      throw new Error(`Aturan ${k.replaceAll("_", " ")} harus ${lo}–${hi}.`);
  }
  if (!["seluruh", "selisih"].includes(a.lembur_mode))
    throw new Error("Mode lembur tidak valid.");
  return a;
}
export type HitunganJam = {
  menit_kerja: number;
  menit_normal: number;
  menit_lembur: number;
  belum_lengkap: number;
  tanpa_jadwal: number;
  referensi_harian: number;
  referensi_perjam: number;
  tarif_lembur: number;
  nominal_lembur: number;
  aturan: AturanGaji;
};
/** Monthly salary remains fixed. Overtime starts after the scheduled end, including overnight shifts. */
export function hitungJamGaji(k: Komponen, baris: BarisRekap[]): HitunganJam {
  const a = aturanGaji(k.aturan);
  const harian = Number(k.gaji_pokok) / a.hari_pembagi;
  const perjam = harian / a.jam_normal;
  let kerja = 0,
    normal = 0,
    lembur = 0,
    incomplete = 0,
    unplanned = 0;
  const seen = new Set<string>();
  for (const b of baris) {
    const ab = b.absen;
    if (!ab || seen.has(ab.id)) continue;
    seen.add(ab.id);
    if (!ab.pulang_at) {
      incomplete++;
      continue;
    }
    const masuk = Date.parse(ab.masuk_at),
      pulang = Date.parse(ab.pulang_at);
    if (
      !Number.isFinite(masuk) ||
      !Number.isFinite(pulang) ||
      pulang <= masuk
    ) {
      incomplete++;
      continue;
    }
    const durasi = Math.max(
      0,
      Math.floor((pulang - masuk) / 60000) - a.istirahat_menit,
    );
    kerja += durasi;
    if (!b.shift) {
      unplanned++;
      normal += durasi;
      continue;
    }
    const akhir = shiftEndInstant(
      b.tanggal,
      b.shift.jam_mulai,
      b.shift.jam_selesai,
    ).getTime();
    const lewat = Math.min(
      durasi,
      Math.max(0, Math.floor((pulang - Math.max(akhir, masuk)) / 60000)),
    );
    const eligible =
      lewat >= a.lembur_min_menit
        ? a.lembur_mode === "selisih"
          ? Math.max(0, lewat - a.lembur_min_menit)
          : lewat
        : 0;
    const dibayar =
      Math.floor(eligible / a.pembulatan_menit) * a.pembulatan_menit;
    lembur += dibayar;
    normal += durasi - dibayar;
  }
  const tarif = (a.lembur_tarif || perjam) * a.lembur_pengali;
  return {
    menit_kerja: kerja,
    menit_normal: normal,
    menit_lembur: lembur,
    belum_lengkap: incomplete,
    tanpa_jadwal: unplanned,
    referensi_harian: Math.round(harian),
    referensi_perjam: Math.round(perjam),
    tarif_lembur: Math.round(tarif),
    nominal_lembur: Math.round((lembur / 60) * tarif),
    aturan: a,
  };
}
