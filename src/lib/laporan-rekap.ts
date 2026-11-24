import { hitung, type Laporan } from "./laporan";
export const marginLaba = (laba: number, omzet: number) =>
  omzet === 0 ? null : (laba / omzet) * 100;
export const persenLaba = (v: number | null) =>
  v === null
    ? "—"
    : `${v.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
export function rekapKeuangan(list: Laporan[]) {
  return list
    .map((l) => {
      const h = hitung(l);
      return {
        id: l.id,
        outlet: l.outlet?.nama ?? l.nama_outlet,
        outletId: l.outlet_id,
        periode: l.periode,
        omzet: h.totalPenjualan,
        laba: h.labaBersih,
        margin: marginLaba(h.labaBersih, h.totalPenjualan),
        mitra: h.bagiMitra,
        pusat: h.pengelola.reduce((t, b) => t + Number(b.jumlah), 0),
        penerima: l.bagi_hasil,
      };
    })
    .sort(
      (a, b) =>
        a.periode.localeCompare(b.periode) || a.outlet.localeCompare(b.outlet),
    );
}
export type HakBayar = {
  key: string;
  nama: string;
  jenis: string;
  jumlah: number;
  bank: string | null;
  rekening: string | null;
};
export type Bayar = {
  id: string;
  laporan_id: string;
  penerima_key: string;
  hak_snapshot: HakBayar;
  jumlah: number;
  pembulatan?: number;
  tanggal: string;
  metode: string;
  bukti: string | null;
  catatan: string;
  status: string;
  versi: number;
  created_at: string;
};
export type Meeting = {
  id: string;
  laporan_id: string;
  judul: string;
  agenda: string;
  jenis: string;
  waktu: string;
  durasi: number;
  lokasi: string;
  peserta: string[];
  diusulkan_oleh: string;
  pengusul_pusat: boolean;
  status: string;
  notulen: string;
  tindak_lanjut: string;
  versi: number;
};
export function ringkasBayar(hak: HakBayar, bayar: Bayar[]) {
  const rows = bayar.filter(
    (b) => b.penerima_key === hak.key && b.status === "tercatat",
  );
  const dibayar = rows.reduce((t, b) => t + Number(b.jumlah), 0),
    pembulatan = rows.reduce((t, b) => t + Number(b.pembulatan ?? 0), 0),
    alokasi = dibayar - pembulatan;
  const beda = rows.some(
    (b) =>
      ["key", "nama", "jenis", "bank", "rekening"].some(
        (k) => b.hak_snapshot[k as keyof HakBayar] !== hak[k as keyof HakBayar],
      ) || Number(b.hak_snapshot.jumlah) !== Number(hak.jumlah),
  );
  const delta = Number(hak.jumlah) - alokasi,
    sisa = Math.abs(delta) < 1e-7 ? 0 : Math.max(0, delta);
  return {
    dibayar,
    pembulatan,
    sisa,
    status: alokasi === 0 ? "Belum tercatat" : sisa > 0 ? "Sebagian" : "Lunas",
    perluCek: beda || delta < -1e-7,
  };
}

export function hakLaporan(
  l: Pick<Laporan, "transfer" | "bagi_hasil">,
): HakBayar[] {
  const t = (l.transfer ?? []).map((t, i) => ({
    key: `transfer:${i + 1}`,
    nama: t.atas_nama || t.keterangan,
    jenis: t.keterangan,
    jumlah: Number(t.jumlah),
    bank: t.bank,
    rekening: t.no_rekening,
  }));
  const bagi = (l.bagi_hasil ?? []).flatMap((b, i) =>
    !t.length ||
    (/pengelola|pusat/i.test(b.nama) &&
      !t.some((t) => /pengelola|pusat/i.test(`${t.nama} ${t.jenis}`)))
      ? [
          {
            key: `bagi:${i + 1}`,
            nama: b.nama,
            jenis: `Bagi hasil ${b.persen}%`,
            jumlah: Number(b.jumlah),
            bank: null,
            rekening: null,
          },
        ]
      : [],
  );
  return [...t, ...bagi].filter((t) => t.jumlah > 0);
}
export const rupiahLaporan = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 12,
  }).format(n);
