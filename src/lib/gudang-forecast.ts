// Smart Forecast stok: laju pemakaian harian per bulan (rata-rata berbobot, bulan terbaru lebih berat) + tren teredam.
export type BulanData = { p: string; b: string; kirim: number; pakai: number };
export type BahanForecast = { id: string; nama: string; kategori: string | null; satuan_beli: string; satuan_pakai: string; konversi: number; harga_beli: number; stok_min: number };
export type HasilForecast = {
  bahan: BahanForecast;
  rateKirim: number; // per hari, satuan pakai
  ratePakai: number;
  kebutuhan: number; // bulan depan, satuan pakai
  stok: number;
  cukupHari: number | null;
  saran: number; // satuan pakai
  saranKemasan: number; // dibulatkan ke atas
  estimasi: number; // rupiah
  status: "kritis" | "beli" | "aman" | "diam";
  riwayat: { p: string; kirim: number; pakai: number }[];
};

const hariDalamBulan = (ym: string) => new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).getUTCDate();
const tambahBulan = (ym: string, n: number) => {
  const d = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1 + n, 1));
  return d.toISOString().slice(0, 7);
};
const hariAntara = (a: string, b: string) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400_000);

/** Bulan yang dipakai: maks. 3 bulan terakhir + bulan berjalan; hari tercakup dihitung dari awal data s.d. hari ini. */
export function bulanAcuan(hariIni: string, awalData: string | null) {
  if (!awalData) return [] as { ym: string; hari: number; total: number }[];
  const ini = hariIni.slice(0, 7);
  const out: { ym: string; hari: number; total: number }[] = [];
  for (let i = 3; i >= 0; i--) {
    const ym = tambahBulan(ini, -i);
    const mulai = ym + "-01" < awalData ? awalData : ym + "-01";
    const akhir = i === 0 ? hariIni : `${ym}-${String(hariDalamBulan(ym)).padStart(2, "0")}`;
    const hari = mulai > akhir ? 0 : hariAntara(mulai, akhir) + 1;
    if (hari > 0) out.push({ ym, hari, total: hariDalamBulan(ym) });
  }
  return out;
}

/** Laju harian berbobot: bobot = urutan kebaruan × porsi hari tercakup; tren antar bulan (diredam 50%) diproyeksikan ke bulan depan. */
export function lajuHarian(nilai: Record<string, number>, acuan: { ym: string; hari: number; total: number }[]) {
  const pakai = acuan.filter((a, i) => a.hari >= 7 || acuan.length === 1 || i < acuan.length - 1);
  if (!pakai.length) return 0;
  const rates = pakai.map((a) => (nilai[a.ym] ?? 0) / a.hari);
  let tw = 0, tr = 0, ti = 0;
  pakai.forEach((a, i) => {
    const w = (i + 1) * (a.hari / a.total);
    tw += w;
    tr += w * rates[i];
    ti += w * i;
  });
  const rata = tw ? tr / tw : 0;
  const penuh = rates.filter((_, i) => pakai[i].hari >= 20);
  const tren = penuh.length >= 2 ? (penuh[penuh.length - 1] - penuh[0]) / (penuh.length - 1) : 0;
  const jarak = tw ? pakai.length - ti / tw : 0; // dari titik tengah berbobot ke bulan depan
  return Math.max(0, rata + 0.5 * tren * jarak);
}

export function hitungForecast(p: {
  bahan: BahanForecast[];
  bulan: BulanData[];
  stok: Record<string, number>;
  hariIni: string;
  awalData: string | null;
  bufferPersen: number;
}): HasilForecast[] {
  const acuan = bulanAcuan(p.hariIni, p.awalData);
  const hariDepan = hariDalamBulan(tambahBulan(p.hariIni.slice(0, 7), 1));
  return p.bahan.map((b) => {
    const kirim: Record<string, number> = {}, pakai: Record<string, number> = {};
    for (const r of p.bulan.filter((x) => x.b === b.id)) {
      const ym = r.p.slice(0, 7);
      kirim[ym] = (kirim[ym] ?? 0) + Number(r.kirim);
      pakai[ym] = (pakai[ym] ?? 0) + Number(r.pakai);
    }
    const rateKirim = lajuHarian(kirim, acuan);
    const ratePakai = lajuHarian(pakai, acuan);
    const rate = Math.max(rateKirim, ratePakai);
    const kebutuhan = rate * hariDepan;
    const stok = Number(p.stok[b.id] ?? 0);
    const cukupHari = rate > 0 ? stok / rate : null;
    const saran = Math.max(0, kebutuhan * (1 + p.bufferPersen / 100) + Number(b.stok_min || 0) - stok);
    const konv = Number(b.konversi) > 0 ? Number(b.konversi) : 1;
    const saranKemasan = saran > 0 ? Math.ceil(saran / konv - 1e-9) : 0;
    const status = rate === 0 ? "diam" : stok <= Number(b.stok_min || 0) || (cukupHari !== null && cukupHari < 7) ? "kritis" : saranKemasan > 0 ? "beli" : "aman";
    return {
      bahan: b,
      rateKirim,
      ratePakai,
      kebutuhan,
      stok,
      cukupHari,
      saran,
      saranKemasan,
      estimasi: saranKemasan * Number(b.harga_beli || 0),
      status,
      riwayat: Object.keys({ ...kirim, ...pakai })
        .sort()
        .map((ym) => ({ p: ym, kirim: kirim[ym] ?? 0, pakai: pakai[ym] ?? 0 })),
    };
  });
}

export function labelData(hariIni: string, awalData: string | null) {
  if (!awalData) return { teks: "Belum ada data pemakaian", nada: "netral" as const };
  const h = hariAntara(awalData, hariIni) + 1;
  if (h < 30) return { teks: `Data ${h} hari · perkiraan kasar`, nada: "kuning" as const };
  if (h < 60) return { teks: "± 1 bulan data", nada: "kuning" as const };
  if (h < 90) return { teks: "± 2 bulan data", nada: "biru" as const };
  return { teks: "3+ bulan data", nada: "hijau" as const };
}
