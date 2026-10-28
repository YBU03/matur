export type GudangLaporan = {
  dokumen?: {
    id: string;
    nomor: string;
    outlet: string;
    tanggal: string;
    diskon: number;
    pajak: number;
    perlu_tinjau: boolean;
  }[];
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
  const diskon = (d.dokumen ?? []).reduce((n, r) => n + Number(r.diskon), 0),
    pajak = (d.dokumen ?? []).reduce((n, r) => n + Number(r.pajak), 0);
  const perluTinjau = (d.dokumen ?? []).filter((r) => r.perlu_tinjau).length;
  const belum =
    d.rows.filter((r) => r.hpp_gudang === null).length +
    d.mutasi.filter((r) => r.hpp === null).length;
  return {
    diskon,
    pajak,
    perluTinjau,
    tagihan: penjualan - diskon + pajak + invoice,
    invoice,
    penjualan,
    hpp,
    biaya,
    penyesuaian,
    labaKotor: penjualanDiketahui - hpp - diskon,
    laba: penjualanDiketahui - hpp - biaya + penyesuaian + invoice - diskon,
    belum,
    penjualanBelum: penjualan - penjualanDiketahui,
    pusat: d.rows
      .filter((r) => r.kepemilikan.toLowerCase() === "pusat")
      .reduce((n, r) => n + Math.round(Number(r.qty) * Number(r.harga)), 0),
  };
}
