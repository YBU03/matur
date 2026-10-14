// Smart forecast stok: perkiraan kapan bahan habis & berapa yang perlu di-restock.
// Pemakaian harian (dari penjualan POS sesuai resep, waste, marketing, kiriman keluar) → rata-rata tertimbang
// 14 hari terakhir (hari terbaru lebih berbobot) × faktor hari dalam seminggu (akhir pekan biasanya lebih ramai).
// Murni & diuji.

export type StatusStok = "habis" | "kritis" | "menipis" | "aman" | "tidak_dipakai";
export type Forecast = {
  rata: number; // perkiraan pemakaian per hari (satuan pakai)
  hariTersisa: number | null; // null = belum ada pemakaian
  tglHabis: string | null; // YYYY-MM-DD
  tglRestock: string | null; // tanggal stok jatuh di bawah batas minimum
  saran: number; // jumlah yang disarankan dibeli/dikirim (satuan pakai)
  saranKemasan: number; // dibulatkan ke atas per kemasan (satuan beli)
  tren: number | null; // % pemakaian 7 hari terakhir vs 7 hari sebelumnya
  status: StatusStok;
};

const geser = (t: string, n: number) => {
  const d = new Date(t + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const hariKe = (t: string) => new Date(t + "T00:00:00Z").getUTCDay();

/**
 * @param harian pemakaian per tanggal (tanggal lama → baru), elemen terakhir = hari ini (bisa belum penuh)
 * @param stok stok saat ini (satuan pakai)
 * @param min batas minimum stok (satuan pakai)
 * @param konversi isi per kemasan beli (mis. 1000 gram per kg)
 * @param cakupan target hari stok setelah restock
 */
export function forecastStok(harian: { tanggal: string; pakai: number }[], stok: number, min: number, konversi = 1, cakupan = 7): Forecast {
  const hariIni = harian.length ? harian[harian.length - 1] : null;
  const penuh = harian.slice(0, -1); // hari yang sudah lewat
  const akhir14 = penuh.slice(-14);
  // rata-rata tertimbang: bobot 1..n (hari terbaru terbesar)
  let sw = 0, sv = 0;
  akhir14.forEach((h, i) => {
    sw += i + 1;
    sv += (i + 1) * Math.max(h.pakai, 0);
  });
  const rata = sw ? sv / sw : 0;
  // faktor hari dalam seminggu dari 28 hari terakhir (minimal 2 sampel per hari)
  const dasar = penuh.slice(-28);
  const umum = dasar.length ? dasar.reduce((t, h) => t + Math.max(h.pakai, 0), 0) / dasar.length : 0;
  const faktor = Array.from({ length: 7 }, (_, d) => {
    const xs = dasar.filter((h) => hariKe(h.tanggal) === d);
    if (xs.length < 2 || !umum) return 1;
    const f = xs.reduce((t, h) => t + Math.max(h.pakai, 0), 0) / xs.length / umum;
    return Math.min(Math.max(f, 0.5), 2);
  });
  const t7 = penuh.slice(-7).reduce((t, h) => t + Math.max(h.pakai, 0), 0);
  const p7 = penuh.slice(-14, -7).reduce((t, h) => t + Math.max(h.pakai, 0), 0);
  const tren = p7 > 0 ? Math.round(((t7 - p7) / p7) * 100) : null;

  const saranDari = (perHari: number) => Math.max(perHari * cakupan + min - Math.max(stok, 0), 0);
  const bulat = (x: number) => Math.round(x * 100) / 100;
  if (!rata || !hariIni) {
    const saran = stok < min ? min - Math.max(stok, 0) : 0;
    return { rata: 0, hariTersisa: null, tglHabis: null, tglRestock: null, saran: bulat(saran), saranKemasan: Math.ceil(saran / (konversi || 1)), tren, status: stok <= 0 && min > 0 ? "habis" : stok < min ? "menipis" : "tidak_dipakai" };
  }
  // simulasi maju per hari mulai hari ini (sisa pemakaian hari ini = perkiraan − yang sudah terpakai)
  let sisa = stok;
  let hari = 0;
  let tglHabis: string | null = null, tglRestock: string | null = stok < min ? hariIni.tanggal : null;
  for (let i = 0; i < 120 && sisa > 0; i++) {
    const t = geser(hariIni.tanggal, i);
    const perlu = rata * faktor[hariKe(t)];
    const pakai = i === 0 ? Math.max(perlu - Math.max(hariIni.pakai, 0), 0) : perlu;
    if (pakai >= sisa) {
      hari += pakai ? sisa / pakai : 0;
      sisa = 0;
      tglHabis = t;
      if (!tglRestock) tglRestock = t;
      break;
    }
    sisa -= pakai;
    hari += 1;
    if (!tglRestock && sisa < min) tglRestock = t;
  }
  const hariTersisa = stok <= 0 ? 0 : tglHabis ? bulat(hari) : 120;
  const saran = saranDari(rata);
  const status: StatusStok = stok <= 0 ? "habis" : hariTersisa < 2 ? "kritis" : stok < min || hariTersisa < 4 ? "menipis" : "aman";
  return { rata: bulat(rata), hariTersisa, tglHabis, tglRestock, saran: bulat(saran), saranKemasan: Math.ceil(saran / (konversi || 1)), tren, status };
}

export const URUT_STATUS: Record<StatusStok, number> = { habis: 0, kritis: 1, menipis: 2, aman: 3, tidak_dipakai: 4 };
