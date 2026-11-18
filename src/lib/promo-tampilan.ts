// Helper tampilan halaman Promo & Diskon. Murni (tanpa I/O) dan tidak mengubah aturan promo.
import type { Promo } from "./promo";

export type StatusPromo = "berjalan" | "terjadwal" | "selesai" | "nonaktif";
export const LABEL_STATUS: Record<StatusPromo, string> = { berjalan: "Berjalan", terjadwal: "Terjadwal", selesai: "Selesai", nonaktif: "Nonaktif" };

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const rp = (n: number) => "Rp" + new Intl.NumberFormat("id-ID").format(Math.round(n));

/** Tanggal (YYYY-MM-DD) dan jam (HH:MM:SS) WIB saat ini. */
export function sekarangWib(now = Date.now()) {
  const iso = new Date(now + 7 * 3600_000).toISOString();
  return { tanggal: iso.slice(0, 10), jam: iso.slice(11, 19) };
}

const jamPenuh = (j: string) => (j.length === 5 ? j + ":00" : j.slice(0, 8));

/** Status tampilan berdasarkan tanggal kalender & jam WIB (sama seperti aturan server). */
export function statusPromo(p: Pick<Promo, "aktif" | "mulai" | "selesai" | "jam_mulai" | "jam_selesai">, now = Date.now()): StatusPromo {
  if (!p.aktif) return "nonaktif";
  const { tanggal, jam } = sekarangWib(now);
  if (tanggal > p.selesai || (tanggal === p.selesai && jam > jamPenuh(p.jam_selesai))) return "selesai";
  if (tanggal < p.mulai) return "terjadwal";
  return "berjalan";
}

/** Apakah saat ini masih di luar jam promo (berjalan, tetapi belum/tidak lagi dalam rentang jam hari ini). */
export function diLuarJam(p: Pick<Promo, "jam_mulai" | "jam_selesai">, now = Date.now()) {
  const { jam } = sekarangWib(now);
  return jam < jamPenuh(p.jam_mulai) || jam > jamPenuh(p.jam_selesai);
}

/** "18 Nov 2026", "18–30 Nov 2026", "28 Nov – 3 Des 2026", "28 Des 2026 – 2 Jan 2027". */
export function rentangTanggal(mulai: string, selesai: string) {
  const [y1, m1, d1] = mulai.split("-").map(Number), [y2, m2, d2] = selesai.split("-").map(Number);
  if (!y1 || !y2) return `${mulai} – ${selesai}`;
  if (mulai === selesai) return `${d1} ${BULAN[m1 - 1]} ${y1}`;
  if (y1 === y2 && m1 === m2) return `${d1}–${d2} ${BULAN[m1 - 1]} ${y1}`;
  if (y1 === y2) return `${d1} ${BULAN[m1 - 1]} – ${d2} ${BULAN[m2 - 1]} ${y1}`;
  return `${d1} ${BULAN[m1 - 1]} ${y1} – ${d2} ${BULAN[m2 - 1]} ${y2}`;
}

/** "Sepanjang hari" atau "07.00–22.00 WIB". */
export function rentangJam(jamMulai: string, jamSelesai: string) {
  const a = jamMulai.slice(0, 5), b = jamSelesai.slice(0, 5);
  if (a === "00:00" && (b === "23:59")) return "Sepanjang hari";
  return `${a.replace(":", ".")}–${b.replace(":", ".")} WIB`;
}

/** Label utama nilai promo, mis. "Diskon 20%", "Potong Rp5.000", "Harga Rp15.000", "Voucher Rp15.000", "Gratis". */
export function labelNilai(p: Pick<Promo, "cakupan" | "nilai_voucher" | "aturan">) {
  if (p.cakupan === "transaksi") return `Voucher ${rp(p.nilai_voucher ?? 0)}`;
  if (!p.aturan.length) return "Belum ada menu";
  const teks = (a: Promo["aturan"][number]) =>
    a.jenis === "gratis" ? "Gratis" : a.jenis === "persen" ? `Diskon ${a.nilai}%` : a.jenis === "potongan" ? `Potong ${rp(a.nilai)}` : `Harga ${rp(a.nilai)}`;
  const unik = [...new Set(p.aturan.map(teks))];
  if (unik.length === 1) return unik[0];
  const jenis = new Set(p.aturan.map((a) => a.jenis));
  if (jenis.size === 1 && p.aturan[0].jenis === "persen") {
    const n = p.aturan.map((a) => a.nilai);
    return `Diskon ${Math.min(...n)}–${Math.max(...n)}%`;
  }
  return "Beragam promo";
}

/** Ringkasan kuota singkat. */
export function labelKuota(p: Pick<Promo, "kuota" | "cakupan" | "per_menu" | "bersama">) {
  if (!p.kuota) return "Tanpa batas kuota";
  return `Kuota ${p.kuota} ${p.cakupan === "transaksi" ? "transaksi" : "item"}/hari · ${p.per_menu ? "per menu" : "gabungan"} · ${p.bersama ? "bersama lintas outlet" : "per outlet"}`;
}

/** Urutan tampil: berjalan → terjadwal (paling dekat) → nonaktif → selesai (terbaru). */
export function urutkanPromo<T extends Promo>(list: T[], now = Date.now()) {
  const bobot: Record<StatusPromo, number> = { berjalan: 0, terjadwal: 1, nonaktif: 2, selesai: 3 };
  return [...list].sort((a, b) => {
    const sa = statusPromo(a, now), sb = statusPromo(b, now);
    if (sa !== sb) return bobot[sa] - bobot[sb];
    if (sa === "terjadwal") return a.mulai.localeCompare(b.mulai);
    return b.selesai.localeCompare(a.selesai) || a.nama.localeCompare(b.nama);
  });
}
