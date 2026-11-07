import { addDays } from "./jadwal/waktu";
export type JadwalMitra = { id: string; outlet_id: string; tanggal: string; nama: string; shift: string | null; mulai: string | null; selesai: string | null; masuk_at: string | null; pulang_at: string | null; telat_menit: number; status: string };
export type AktifMitra = { id: string; outlet_id: string; nama: string; shift: string | null; masuk_at: string; telat_menit: number };
export type DataJadwalMitra = { outlets: { id: string; nama: string }[]; jadwal: JadwalMitra[]; aktif: AktifMitra[] };
export function awalMingguMitra(tanggal: string | undefined, hariIni: string) {
  const value = tanggal && /^\d{4}-\d{2}-\d{2}$/.test(tanggal) && tanggal >= "1900-01-01" && tanggal <= "2200-12-31" && !Number.isNaN(Date.parse(tanggal)) && new Date(`${tanggal}T00:00:00Z`).toISOString().slice(0, 10) === tanggal ? tanggal : hariIni;
  const day = new Date(`${value}T00:00:00Z`).getUTCDay();
  return addDays(value, -(day + 6) % 7);
}
export function statusJadwalMitra(r: JadwalMitra) {
  if (["libur", "izin", "sakit"].includes(r.status)) return { teks: r.status[0].toUpperCase() + r.status.slice(1), warna: "bg-violet-50 text-violet-800" };
  if (r.pulang_at) return { teks: "Selesai bertugas", warna: "bg-stone-100 text-stone-600" };
  if (r.masuk_at) return { teks: r.telat_menit > 0 ? `Telat ${r.telat_menit} menit` : "Tepat waktu", warna: r.telat_menit > 0 ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800" };
  return { teks: "Terjadwal", warna: "bg-amber-50 text-amber-800" };
}
