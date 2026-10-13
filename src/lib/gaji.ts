// Hitung slip gaji dari komponen gaji staf + ringkasan absensi sebulan. Murni (bisa diuji, dipakai server & browser).

export type Komponen = { gaji_pokok: number; tunjangan: number; uang_makan: number; potongan_telat: number; potongan_alpa: number };
export type Baris = { nama: string; jumlah: number; manual?: boolean };
export type Kehadiran = { hadir: number; telat: number; menitTelat: number; tidakAbsen: number; izin: number; menitKerja: number };

export const KOMPONEN_KOSONG: Komponen = { gaji_pokok: 0, tunjangan: 0, uang_makan: 0, potongan_telat: 0, potongan_alpa: 0 };

const bulat = (n: number) => Math.round(Number(n) || 0);
export const jumlahkan = (xs: Baris[]) => xs.reduce((s, x) => s + bulat(x.jumlah), 0);

/** Baris otomatis dari komponen & kehadiran; baris tambahan (bonus, lembur, kasbon, dll.) disimpan terpisah oleh HRD. */
export function hitungSlip(k: Komponen, h: Kehadiran) {
  const pendapatan: Baris[] = [
    { nama: "Gaji pokok", jumlah: bulat(k.gaji_pokok) },
    { nama: "Tunjangan", jumlah: bulat(k.tunjangan) },
    { nama: `Uang makan (${h.hadir} hari hadir)`, jumlah: bulat(k.uang_makan) * h.hadir },
  ].filter((b) => b.jumlah > 0);
  const potongan: Baris[] = [
    { nama: `Telat (${h.telat}×, ${h.menitTelat} menit)`, jumlah: bulat(k.potongan_telat) * h.telat },
    { nama: `Tidak masuk tanpa izin (${h.tidakAbsen} hari)`, jumlah: bulat(k.potongan_alpa) * h.tidakAbsen },
  ].filter((b) => b.jumlah > 0);
  return { pendapatan, potongan, total: Math.max(jumlahkan(pendapatan) - jumlahkan(potongan), 0) };
}

/** Total akhir slip setelah diedit (tidak pernah negatif). */
export const totalSlip = (pendapatan: Baris[], potongan: Baris[]) => Math.max(jumlahkan(pendapatan) - jumlahkan(potongan), 0);
