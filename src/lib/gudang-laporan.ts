export type GudangLaporan = {
  invoice?: {
    id: string;
    nomor: string;
    outlet: string;
    kepemilikan: string;
    tanggal: string;
    nilai: number;
    keterangan: string;
  }[];
  rows: {
    id: string;
    nomor: string;
    outlet_id: string;
    outlet: string;
    kepemilikan: string;
    waktu: string;
    bahan_id: string;
    nama: string;
    harga: number;
    hpp_gudang: number | null;
    qty: number;
  }[];
  biaya: {
    id: string;
    tanggal: string;
    jumlah: number;
    keterangan: string;
    outlet_id: string | null;
  }[];
  mutasi: {
    id: string;
    nama: string;
    jenis: string;
    jumlah: number;
    hpp: number | null;
    tanggal: string;
  }[];
};
export function ringkasGudang(d: GudangLaporan) {
  const penjualan = d.rows.reduce(
    (n, r) => n + Math.round(Number(r.qty) * Number(r.harga)),
    0,
  );
  const diketahui = d.rows.filter((r) => r.hpp_gudang !== null);
  const penjualanDiketahui = diketahui.reduce(
    (n, r) => n + Math.round(Number(r.qty) * Number(r.harga)),
    0,
  );
  const hpp = diketahui.reduce(
    (n, r) => n + Number(r.qty) * Number(r.hpp_gudang),
    0,
  );
  const biaya = d.biaya.reduce((n, r) => n + Number(r.jumlah), 0);
  const penyesuaian = d.mutasi
    .filter((r) => r.hpp !== null)
    .reduce((n, r) => n + Number(r.jumlah) * Number(r.hpp), 0);
  const invoice = (d.invoice ?? []).reduce((n, r) => n + Number(r.nilai), 0);
  const belum =
    d.rows.filter((r) => r.hpp_gudang === null).length +
    d.mutasi.filter((r) => r.hpp === null).length;
  return {
    invoice,
    penjualan,
    hpp,
    biaya,
    penyesuaian,
    labaKotor: penjualanDiketahui - hpp,
    laba: penjualanDiketahui - hpp - biaya + penyesuaian + invoice,
    belum,
    penjualanBelum: penjualan - penjualanDiketahui,
    pusat: d.rows
      .filter((r) => r.kepemilikan.toLowerCase() === "pusat")
      .reduce((n, r) => n + Math.round(Number(r.qty) * Number(r.harga)), 0),
  };
}
