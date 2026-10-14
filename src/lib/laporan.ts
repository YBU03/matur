// Laporan keuangan bulanan (format resmi CV. Hazna Berkah Indonesia). Dipakai di server & browser.

export type Baris = { nama: string; jumlah: number };
export type BagiHasil = { nama: string; persen: number; jumlah: number };
export type Transfer = { keterangan: string; jumlah: number; bank: string | null; no_rekening: string | null; atas_nama: string | null };
export type Laporan = {
  id: string;
  outlet_id: string;
  periode: string;
  nama_outlet: string;
  mitra: string | null;
  pj_laporan: string | null;
  karyawan: string[];
  modal_awal: number;
  persediaan_awal: number;
  pembelian: number;
  /** tagihan dessert & cheesecake titipan: yang terjual × harga produsen (masuk HPP) */
  tagihan_titipan?: number;
  persediaan_akhir: number;
  pendapatan: Baris[];
  diskon: number;
  persen_sedekah: number;
  sedekah: number;
  beban: Baris[];
  bagi_hasil: BagiHasil[];
  transfer: Transfer[];
  tgl_terbit: string | null;
  kota_terbit: string | null;
  penandatangan: string | null;
  jabatan_penandatangan: string | null;
  catatan: string | null;
  laba_bersih: number | null;
  outlet?: { nama: string; tgl_mulai: string | null; jam_operasional: string | null } | null;
};
export type Perusahaan = { nama: string; alamat: string | null; email: string | null; telepon: string | null };

export const LAPORAN_COLS =
  "id, outlet_id, periode, nama_outlet, mitra, pj_laporan, karyawan, modal_awal, persediaan_awal, pembelian, tagihan_titipan, persediaan_akhir, pendapatan, diskon, persen_sedekah, sedekah, beban, bagi_hasil, transfer, tgl_terbit, kota_terbit, penandatangan, jabatan_penandatangan, catatan, laba_bersih, outlet(nama, tgl_mulai, jam_operasional)";

const sum = (xs: { jumlah: number }[]) => xs.reduce((s, x) => s + Number(x.jumlah || 0), 0);

/** Hitungan laporan; laba bersih memakai angka resmi bila tersimpan (selisih pembulatan Excel ±Rp1). */
export function hitung(l: Laporan) {
  const totalPenjualan = sum(l.pendapatan) - l.diskon;
  // HPP = persediaan awal + pembelian bahan baku + tagihan dessert & cheesecake − persediaan akhir
  const tersedia = l.persediaan_awal + l.pembelian + Number(l.tagihan_titipan ?? 0);
  const hpp = tersedia - l.persediaan_akhir;
  const labaKotor = totalPenjualan - hpp;
  const labaBersih = l.laba_bersih ?? labaKotor - l.sedekah - sum(l.beban);
  const totalBeban = labaKotor - labaBersih;
  const modal = l.modal_awal + labaBersih;
  const pengelola = l.bagi_hasil.filter((b) => /pengelola/i.test(b.nama));
  const mitra = l.bagi_hasil.filter((b) => !/pengelola/i.test(b.nama));
  const totalTransfer = sum(l.transfer);
  return { totalPenjualan, tersedia, hpp, labaKotor, totalBeban, labaBersih, modal, pengelola, mitra, bagiMitra: sum(mitra), totalTransfer };
}

export const namaBulan = (periode: string) => new Date(periode + "T00:00:00").toLocaleDateString("id-ID", { month: "long", year: "numeric" });

/** Nama baris pendapatan laporan resmi dari kanal/metode POS */
export const BARIS_PENDAPATAN: [string, string][] = [
  ["tunai", "Penjualan tunai"],
  ["non_tunai", "Penjualan non tunai"],
  ["gofood", "Go Food"],
  ["grabfood", "Grab Food"],
  ["shopeefood", "Shopee Food"],
  ["tiktok", "Tiktok Go"],
  ["ruma_app", "Ruma App"],
  ["tumbler", "Tumbler"],
];
export const PENDAPATAN_LAIN = "Pendapatan Lain-Lain (Online Food dan pendapatan kotor)";

export type Proyeksi = {
  jumlah_transaksi: number;
  pendapatan: Record<string, number>;
  diskon: number;
  pembelian: number;
  pembelian_rincian?: Record<string, number>;
  opname?: { tanggal: string; nilai: number } | null;
  jumlah_kiriman: number;
  persediaan_akhir_sistem: number;
  beban: Baris[];
  harian: { tanggal: string; penjualan: number; diskon: number; transaksi: number; pembelian: number; biaya: number }[];
};
