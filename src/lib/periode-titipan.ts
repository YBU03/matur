export type PeriodeTitipan = "harian" | "mingguan" | "bulanan";
export function periodeTitipan(tanggal: string, periode: PeriodeTitipan) {
  const d = new Date(`${tanggal}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(tanggal) ||
    !Number.isFinite(d.getTime()) ||
    d.toISOString().slice(0, 10) !== tanggal
  )
    throw new Error("Tanggal tidak valid");
  const a = new Date(d);
  const b = new Date(d);
  if (periode === "mingguan") {
    a.setUTCDate(a.getUTCDate() - ((a.getUTCDay() + 6) % 7));
    b.setTime(a.getTime());
    b.setUTCDate(b.getUTCDate() + 6);
  }
  if (periode === "bulanan") {
    a.setUTCDate(1);
    b.setUTCMonth(b.getUTCMonth() + 1, 0);
  }
  return {
    awal: a.toISOString().slice(0, 10),
    akhir: b.toISOString().slice(0, 10),
  };
}
