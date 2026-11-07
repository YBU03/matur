export type OutletAcuan = { id: string; nama: string };
export type AcuanBulanan = { outletId: string; periode: string; omzet: number; hpp: number; beban: number };
export type PilihanAcuan = { outletId: string; dari: string; sampai: string };

export function geserBulan(bulan: string, selisih: number) {
  const [y, m] = bulan.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + selisih, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
const validBulan = (s: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

/** Setiap laporan outlet-bulan berbobot sama; HPP adalah rasio total biaya terhadap total omzet. */
export function hitungAcuanBulanan(data: AcuanBulanan[], outlets: OutletAcuan[], p: PilihanAcuan) {
  if (!validBulan(p.dari) || !validBulan(p.sampai) || p.dari > p.sampai) return { error: "Pilih bulan awal dan akhir yang valid. Bulan akhir tidak boleh mendahului bulan awal." } as const;
  const dipilih = outlets.filter(o => p.outletId === "semua" || o.id === p.outletId);
  const ids = new Set(dipilih.map(o => o.id));
  const xs = data.filter(a => ids.has(a.outletId) && a.periode >= p.dari && a.periode <= p.sampai);
  const [ya, ma] = p.dari.split("-").map(Number), [yb, mb] = p.sampai.split("-").map(Number);
  const bulan = (yb - ya) * 12 + mb - ma + 1;
  const kosong = Math.max(0, bulan * dipilih.length - xs.length);
  if (!xs.length) return { error: "Belum ada laporan untuk outlet dan periode ini. Silakan pilih periode lain atau isi asumsi secara manual.", kosong } as const;
  const omzet = xs.reduce((s, a) => s + a.omzet, 0);
  return { jumlah: xs.length, outlet: new Set(xs.map(a => a.outletId)).size, kosong,
    omzet: Math.round(omzet / xs.length),
    hpp: omzet ? Math.round(xs.reduce((s, a) => s + a.hpp, 0) / omzet * 1000) / 10 : 0,
    beban: Math.round(xs.reduce((s, a) => s + a.beban, 0) / xs.length),
  } as const;
}
