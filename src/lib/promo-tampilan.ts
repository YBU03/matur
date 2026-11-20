// Helper tampilan Promo & Diskon (halaman /promo dan kotak promo kasir). Murni, tidak mengubah aturan server.
// Logika waktu mencerminkan promo_internal.akhir_slot: slot lewat tengah malam milik tanggal/hari saat slot dimulai.
import type { Promo, SlotPromo } from "./promo";

export type StatusPromo = "berjalan" | "terjadwal" | "selesai" | "nonaktif";
export const LABEL_STATUS: Record<StatusPromo, string> = { berjalan: "Berjalan", terjadwal: "Terjadwal", selesai: "Selesai", nonaktif: "Nonaktif" };
export const NAMA_HARI = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
export const SEMUA_HARI = [1, 2, 3, 4, 5, 6, 7];
export const PRESET_JAM: { label: string; slot: SlotPromo }[] = [
  { label: "Sepanjang hari", slot: { mulai: "00:00", selesai: "23:59" } },
  { label: "☕ Ngopi Pagi", slot: { mulai: "07:00", selesai: "10:00" } },
  { label: "🍽 Siang", slot: { mulai: "11:00", selesai: "14:00" } },
  { label: "🌇 Sore", slot: { mulai: "15:00", selesai: "18:00" } },
  { label: "🌙 Malam", slot: { mulai: "19:00", selesai: "22:00" } },
];

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const rp = (n: number) => "Rp" + new Intl.NumberFormat("id-ID").format(Math.round(n));
const detik = (j: string) => {
  const [h, m, s] = j.split(":").map(Number);
  return (h || 0) * 3600 + (m || 0) * 60 + (s || 0);
};
const tambahHari = (iso: string, n: number) => new Date(Date.parse(iso + "T00:00:00Z") + n * 86400_000).toISOString().slice(0, 10);
const isoDow = (iso: string) => ((new Date(iso + "T00:00:00Z").getUTCDay() + 6) % 7) + 1;
const jam5 = (j: string) => j.slice(0, 5).replace(":", ".");

/** Tanggal (YYYY-MM-DD) dan detik sejak 00.00 WIB saat ini. */
export function sekarangWib(now = Date.now()) {
  const iso = new Date(now + 7 * 3600_000).toISOString();
  return { tanggal: iso.slice(0, 10), jam: iso.slice(11, 19), detik: detik(iso.slice(11, 19)) };
}

/** Slot efektif promo (data lama tanpa slot = jam_mulai–jam_selesai). */
export function slotPromo(p: Pick<Promo, "slot" | "jam_mulai" | "jam_selesai">): SlotPromo[] {
  return p.slot?.length ? p.slot : [{ mulai: p.jam_mulai, selesai: p.jam_selesai }];
}
export const hariPromo = (p: Pick<Promo, "hari">) => (p.hari?.length ? p.hari : SEMUA_HARI);
const lewatMalam = (s: SlotPromo) => detik(s.selesai) <= detik(s.mulai);

/** Waktu (ms) akhir slot yang sedang berlaku, atau null. */
export function akhirSlot(p: Pick<Promo, "slot" | "jam_mulai" | "jam_selesai" | "hari" | "mulai" | "selesai">, now = Date.now()): number | null {
  const { tanggal: d, detik: t } = sekarangWib(now);
  const hr = hariPromo(p), dalam = (x: string) => x >= p.mulai && x <= p.selesai && hr.includes(isoDow(x));
  const ms = (tgl: string, j: string) => Date.parse(`${tgl}T${j.length === 5 ? j + ":00" : j.slice(0, 8)}+07:00`);
  let hasil: number | null = null;
  for (const s of slotPromo(p)) {
    const m = detik(s.mulai), e = detik(s.selesai);
    if (e > m) {
      if (t >= m && t <= e && dalam(d)) hasil = Math.max(hasil ?? 0, ms(d, s.selesai));
    } else {
      if (t >= m && dalam(d)) hasil = Math.max(hasil ?? 0, ms(tambahHari(d, 1), s.selesai));
      if (t <= e && dalam(tambahHari(d, -1))) hasil = Math.max(hasil ?? 0, ms(d, s.selesai));
    }
  }
  return hasil;
}

/** Jam mulai slot berikutnya hari ini ("15.00"), bila ada. */
export function mulaiLagi(p: Pick<Promo, "slot" | "jam_mulai" | "jam_selesai" | "hari" | "mulai" | "selesai">, now = Date.now()) {
  const { tanggal: d, detik: t } = sekarangWib(now);
  if (d < p.mulai || d > p.selesai || !hariPromo(p).includes(isoDow(d))) return null;
  const next = slotPromo(p).map((s) => s.mulai).filter((m) => detik(m) > t).sort((a, b) => detik(a) - detik(b))[0];
  return next ? jam5(next) : null;
}

/** Status kartu promo berdasarkan tanggal & slot WIB. */
export function statusPromo(p: Pick<Promo, "aktif" | "mulai" | "selesai" | "jam_mulai" | "jam_selesai" | "slot">, now = Date.now()): StatusPromo {
  if (!p.aktif) return "nonaktif";
  const { tanggal, detik: t } = sekarangWib(now);
  const sl = slotPromo(p);
  const akhirTerakhir = sl.some(lewatMalam) ? Infinity : Math.max(...sl.map((s) => detik(s.selesai)));
  if (tanggal > (sl.some(lewatMalam) ? tambahHari(p.selesai, 1) : p.selesai) || (tanggal === p.selesai && t > akhirTerakhir)) return "selesai";
  if (tanggal < p.mulai) return "terjadwal";
  return "berjalan";
}

/** Berjalan menurut tanggal, tetapi saat ini bukan jam/hari promo. */
export function diLuarJam(p: Pick<Promo, "slot" | "jam_mulai" | "jam_selesai" | "hari" | "mulai" | "selesai">, now = Date.now()) {
  return akhirSlot(p, now) === null;
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
  if (a === "00:00" && b === "23:59") return "Sepanjang hari";
  return `${jam5(a)}–${jam5(b)} WIB`;
}

/** "Setiap hari", "Sen–Jum", "Sab–Min", "Sen, Rab, Jum". */
export function labelHari(hari?: number[]) {
  const h = [...new Set(hari?.length ? hari : SEMUA_HARI)].sort((a, b) => a - b);
  if (h.length === 7) return "Setiap hari";
  const urut = h.every((x, i) => i === 0 || x === h[i - 1] + 1);
  if (urut && h.length >= 3) return `${NAMA_HARI[h[0] - 1]}–${NAMA_HARI[h[h.length - 1] - 1]}`;
  return h.map((x) => NAMA_HARI[x - 1]).join(", ");
}

/** "Sen–Jum · 07.00–10.00 & 15.00–17.00 WIB" atau "Setiap hari · Sepanjang hari". */
export function labelWaktu(p: Pick<Promo, "slot" | "jam_mulai" | "jam_selesai" | "hari">) {
  const sl = slotPromo(p);
  const jam = sl.length === 1 ? rentangJam(sl[0].mulai, sl[0].selesai) : sl.map((s) => `${jam5(s.mulai)}–${jam5(s.selesai)}`).join(" & ") + " WIB";
  return `${labelHari(p.hari)} · ${jam}`;
}

/** Nilai legacy jam_mulai/jam_selesai untuk server (constraint jam_selesai > jam_mulai). */
export function jamLegacy(slot: SlotPromo[]) {
  if (slot.length === 1 && !lewatMalam(slot[0])) return { jam_mulai: slot[0].mulai, jam_selesai: slot[0].selesai.length === 5 && slot[0].selesai === "23:59" ? "23:59:59" : slot[0].selesai };
  if (!slot.some(lewatMalam)) {
    const urut = [...slot].sort((a, b) => detik(a.mulai) - detik(b.mulai));
    return { jam_mulai: urut[0].mulai, jam_selesai: [...slot].sort((a, b) => detik(b.selesai) - detik(a.selesai))[0].selesai };
  }
  return { jam_mulai: "00:00", jam_selesai: "23:59:59" };
}

/** Kesalahan isian slot (untuk ditampilkan sebelum menyimpan). */
export function cekSlot(slot: SlotPromo[]) {
  if (!slot.length) return "Tambahkan minimal satu jam promo";
  if (slot.length > 6) return "Maksimal 6 slot jam per promo";
  if (slot.some((s) => detik(s.mulai) === detik(s.selesai))) return "Jam mulai dan selesai tidak boleh sama";
  return "";
}

/** Harga satu item setelah aturan promo (sama seperti server, sebelum varian). */
export function hargaPromo(harga: number, jenis: Promo["aturan"][number]["jenis"], nilai: number) {
  const potong = jenis === "gratis" ? harga : jenis === "persen" ? Math.floor((harga * nilai) / 100) : jenis === "potongan" ? Math.min(harga, nilai) : Math.max(harga - nilai, 0);
  return harga - potong;
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

/** Kalimat kuota yang mudah dibaca. */
export function labelKuota(p: Pick<Promo, "kuota" | "cakupan" | "per_menu" | "bersama">) {
  if (!p.kuota) return "Tanpa batas kuota";
  const unit = p.cakupan === "transaksi" ? "transaksi" : "cup/item";
  return `Maks ${p.kuota} ${unit} per hari ${p.bersama ? "untuk semua outlet bersama" : "di setiap outlet"}${p.cakupan === "transaksi" ? "" : p.per_menu ? ", dihitung per menu" : ", gabungan semua menu"}`;
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

/** Pesan error server → kalimat yang mudah dipahami. */
export function pesanRamah(e: string) {
  if (/violates check constraint.*jam/i.test(e)) return "Jam promo tidak valid. Periksa jam mulai dan selesai.";
  if (/violates check constraint.*selesai/i.test(e)) return "Tanggal selesai tidak boleh sebelum tanggal mulai.";
  if (/violates check constraint.*nama/i.test(e)) return "Nama promo wajib diisi (maksimal 120 huruf).";
  if (/invalid input syntax|invalid input value/i.test(e)) return "Ada isian yang belum lengkap atau formatnya salah. Periksa tanggal, jam dan nilai promo.";
  if (/null value|not-null/i.test(e)) return "Ada isian wajib yang masih kosong.";
  if (/JWT|session|auth/i.test(e)) return "Sesi berakhir. Muat ulang halaman lalu masuk kembali.";
  return e;
}

/** Hitung mundur "01:24:35". */
export function hitungMundur(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((x) => String(x).padStart(2, "0")).join(":");
}

/**
 * Bagi unit berpromo per baris keranjang sesuai `rincian` server (unit per menu yang dapat potongan),
 * mengikuti urutan keranjang — sama seperti server. Mengembalikan jumlah unit promo & normal per baris.
 */
export function bagiPromo<T extends { menu_id: string; qty: number; layak: boolean }>(lines: T[], rincian?: Record<string, number> | null) {
  const sisa = { ...(rincian ?? {}) };
  return lines.map((l) => {
    if (!l.layak || !rincian) return { promo: 0, normal: l.qty };
    const dapat = Math.max(0, Math.min(l.qty, sisa[l.menu_id] ?? 0));
    sisa[l.menu_id] = (sisa[l.menu_id] ?? 0) - dapat;
    return { promo: dapat, normal: l.qty - dapat };
  });
}

/** "Kuota tinggal 3 — 3 item dapat promo, 1 item harga normal." */
export function pesanKuotaSebagian(rincian?: Record<string, number> | null, lebih?: Record<string, number> | null) {
  const dapat = Object.values(rincian ?? {}).reduce((s, n) => s + n, 0);
  const normal = Object.values(lebih ?? {}).reduce((s, n) => s + n, 0);
  if (!normal) return "";
  return `Kuota tinggal ${dapat} — ${dapat} item dapat promo, ${normal} item harga normal.`;
}
