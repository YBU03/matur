export type JamTanggal = { tgl: string; jam: number; trx: number };
export type DataJamTanggal = { cells: JamTanggal[]; tanpa_jam: number };
export type PekanTanggal = { dari: string; sampai: string; tanggal: string[] };

/** Kelompok kalender 1–7, 8–14, 15–21, 22–28, 29–akhir; dipotong periode pilihan. */
export function pekanTanggal(dari: string, sampai: string): PekanTanggal[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dari) || !/^\d{4}-\d{2}-\d{2}$/.test(sampai) || dari > sampai) return [];
  const hasil: PekanTanggal[] = [];
  let key = "";
  for (let ms = Date.parse(`${dari}T00:00:00Z`); ms <= Date.parse(`${sampai}T00:00:00Z`); ms += 86400000) {
    const d = new Date(ms);
    const tgl = d.toISOString().slice(0, 10);
    const k = `${tgl.slice(0, 7)}:${Math.floor((d.getUTCDate() - 1) / 7)}`;
    if (key !== k) { hasil.push({ dari: tgl, sampai: tgl, tanggal: [] }); key = k; }
    const p = hasil[hasil.length - 1];
    p.sampai = tgl;
    p.tanggal.push(tgl);
  }
  return hasil;
}
export function jamDalamPekan(cells: readonly JamTanggal[], pekan: PekanTanggal) {
  return cells.filter(c => c.tgl >= pekan.dari && c.tgl <= pekan.sampai);
}
