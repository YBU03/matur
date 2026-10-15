import type { BarisRekap, StatusHari } from "./jadwal/rekap";

export type RingkasanHrd = { tercatat: number; terjadwal: number; hadir: number; tepat: number; telat: number; belum: number; tidak: number; izin: number; sakit: number; libur: number; tanpaJadwal: number; persen: number | null };
const prioritas: Record<StatusHari, number> = { telat: 8, tepat: 7, tanpa_jadwal: 6, sakit: 5, izin: 4, libur: 3, tidak_absen: 2, belum: 1 };
/** Hitung orang per tanggal kerja, bukan jumlah baris shift; orang lintas outlet juga tidak dihitung dua kali. */
export function ringkasHrd(rows: BarisRekap[]): RingkasanHrd {
  const orang = new Map<string, { status: StatusHari; terjadwal: boolean; hadirTerjadwal: boolean; hadir: boolean }>();
  for (const r of rows) {
    const key = `${r.pengguna_id}|${r.tanggal}`;
    const x = orang.get(key);
    if (!x) orang.set(key, { status: r.status, terjadwal: !!r.shift, hadirTerjadwal: !!r.shift && !!r.absen, hadir: !!r.absen });
    else {
      if (prioritas[r.status] > prioritas[x.status]) x.status = r.status;
      x.terjadwal ||= !!r.shift;
      x.hadirTerjadwal ||= !!r.shift && !!r.absen;
      x.hadir ||= !!r.absen;
    }
  }
  const xs = [...orang.values()];
  const jumlah = (s: StatusHari) => xs.filter((r) => r.status === s).length;
  const terjadwal = xs.filter((r) => r.terjadwal).length;
  return { tercatat: xs.length, terjadwal, hadir: xs.filter((r) => r.hadir).length, tepat: jumlah("tepat"), telat: jumlah("telat"), belum: jumlah("belum"), tidak: jumlah("tidak_absen"), izin: jumlah("izin"), sakit: jumlah("sakit"), libur: jumlah("libur"), tanpaJadwal: jumlah("tanpa_jadwal"), persen: terjadwal ? Math.round(xs.filter((r) => r.hadirTerjadwal).length / terjadwal * 100) : null };
}
