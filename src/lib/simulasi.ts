// Simulasi kemitraan untuk calon mitra: proyeksi laba & BEP per bulan. Rumus mengikuti format laporan Ruma:
// laba kotor = penjualan − HPP; sedekah = % × laba kotor; laba bersih = laba kotor − sedekah − beban; bagi hasil dari laba bersih.

export type InputSimulasi = {
  investasi: number;
  omzet: number; // penjualan bulan pertama
  tumbuh: number; // % pertumbuhan penjualan per bulan
  hpp: number; // % HPP dari penjualan
  beban: number; // beban operasional per bulan (gaji, listrik, sewa, dll.)
  sedekah: number; // % dari laba kotor
  mitra: number; // % bagian mitra dari laba bersih
  bulan: number; // lama proyeksi
};
export type BulanSimulasi = { ke: number; penjualan: number; labaKotor: number; labaBersih: number; bagianMitra: number; akumMitra: number; akumOutlet: number };

export function simulasikan(x: InputSimulasi) {
  const baris: BulanSimulasi[] = [];
  let akumMitra = 0, akumOutlet = 0, bepMitra: number | null = null, bepOutlet: number | null = null;
  for (let i = 1; i <= Math.min(Math.max(Math.round(x.bulan), 1), 120); i++) {
    const penjualan = x.omzet * Math.pow(1 + x.tumbuh / 100, i - 1);
    const labaKotor = penjualan * (1 - x.hpp / 100);
    const labaBersih = labaKotor - labaKotor * (x.sedekah / 100) - x.beban;
    const bagianMitra = Math.max(labaBersih, 0) * (x.mitra / 100);
    akumMitra += bagianMitra;
    akumOutlet += labaBersih;
    if (bepMitra === null && x.investasi > 0 && akumMitra >= x.investasi) bepMitra = i;
    if (bepOutlet === null && x.investasi > 0 && akumOutlet >= x.investasi) bepOutlet = i;
    baris.push({ ke: i, penjualan, labaKotor, labaBersih, bagianMitra, akumMitra, akumOutlet });
  }
  const b1 = baris[0];
  return {
    baris,
    bepMitra,
    bepOutlet,
    roiTahunan: x.investasi > 0 ? (baris.slice(0, 12).reduce((t, b) => t + b.bagianMitra, 0) / x.investasi) * 100 : 0,
    labaBulan1: b1?.labaBersih ?? 0,
    mitraBulan1: b1?.bagianMitra ?? 0,
  };
}
