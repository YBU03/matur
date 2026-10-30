export const PERIODE_TITIPAN = [
  "harian",
  "mingguan",
  "sepuluh_hari",
  "bulanan",
  "kustom",
] as const;
export type PeriodeTitipan = (typeof PERIODE_TITIPAN)[number];
function bacaTanggal(tanggal: string) {
  const d = new Date(`${tanggal}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(tanggal) ||
    !Number.isFinite(d.getTime()) ||
    d.toISOString().slice(0, 10) !== tanggal
  )
    throw new Error("Isi tanggal yang valid.");
  return d;
}
export function periodeTitipan(
  tanggal: string,
  periode: PeriodeTitipan,
  akhirKustom?: string,
) {
  const d = bacaTanggal(tanggal);
  const a = new Date(d);
  const b = new Date(d);
  if (periode === "kustom") {
    const akhir = bacaTanggal(akhirKustom ?? "");
    const hari = (akhir.getTime() - a.getTime()) / 86400000;
    if (hari < 0)
      throw new Error(
        "Tanggal akhir harus sama dengan atau setelah tanggal mulai.",
      );
    if (hari >= 366) throw new Error("Rentang kustom maksimal 366 hari.");
    b.setTime(akhir.getTime());
  } else if (periode === "mingguan") {
    a.setUTCDate(a.getUTCDate() - ((a.getUTCDay() + 6) % 7));
    b.setTime(a.getTime());
    b.setUTCDate(b.getUTCDate() + 6);
  } else if (periode === "sepuluh_hari") {
    const mulai = d.getUTCDate() <= 10 ? 1 : d.getUTCDate() <= 20 ? 11 : 21;
    a.setUTCDate(mulai);
    if (mulai === 21) b.setUTCMonth(b.getUTCMonth() + 1, 0);
    else b.setUTCDate(mulai + 9);
  } else if (periode === "bulanan") {
    a.setUTCDate(1);
    b.setUTCMonth(b.getUTCMonth() + 1, 0);
  } else if (periode !== "harian") throw new Error("Periode tidak tersedia.");
  return {
    awal: a.toISOString().slice(0, 10),
    akhir: b.toISOString().slice(0, 10),
  };
}
export function tautanTitipan(
  outlet: string,
  tanggal: string,
  periode: PeriodeTitipan,
  akhir?: string,
) {
  const params = new URLSearchParams({ outlet, tanggal, periode });
  if (periode === "kustom" && akhir) params.set("akhir", akhir);
  return `/titipan?${params}`;
}
