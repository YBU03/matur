export type StokRingkas = {
  outlet_id: string;
  outlet: string;
  bahan_id: string;
  nama: string;
  satuan: string;
  awal: number;
  akhir: number;
  sekarang: number;
  minimum: number;
  aktif: boolean;
  masuk: number;
  pakai: number;
  kembali: number;
  waste: number;
  marketing: number;
  so: number;
  koreksi: number;
  keluar_lain: number;
};
export type StokGerak = {
  id: string;
  created_at: string;
  outlet_id: string;
  outlet: string;
  bahan_id: string;
  nama: string;
  satuan: string;
  jenis: string;
  jumlah: number;
  keterangan: string | null;
  ref_id: string | null;
  petugas: string | null;
  foto?: string;
};
export type LaporanStokOutlet = {
  ringkasan: StokRingkas[];
  riwayat: StokGerak[];
  setelan?: {
    created_at: string;
    outlet: string;
    nama: string;
    petugas: string;
    alasan: string;
    minimum: number;
    aktif: boolean;
  }[];
  lanjut: boolean;
  mulai: string;
  selesai: string;
  dibaca_at: string;
  awal_riwayat: string | null;
};
export type BahanOutlet = {
  satuan_beli?: string;
  konversi?: number;
  id: string;
  nama: string;
  satuan_pakai: string;
  stok_min: number;
};
export type ItemStok = {
  bahan_id: string;
  nama: string;
  satuan: string;
  jumlah: number;
};
export type PermintaanStok = {
  id: string;
  outlet_id: string;
  items: ItemStok[];
  catatan: string;
  status: string;
  kiriman_id: string | null;
  created_at: string;
  kiriman?: { status: string; nomor: string } | null;
};
export type TransferStok = {
  id: string;
  asal: string;
  tujuan: string;
  items: ItemStok[];
  status: string;
  catatan: string;
  created_at: string;
};
export const QTY_STOK = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 3,
});
export const LABEL_GERAK: Record<string, string> = {
  pemakaian: "Pemakaian resep POS",
  void: "Pengembalian void",
  opname: "Penyesuaian SO",
  koreksi: "Koreksi stok",
  waste: "Waste / rusak",
  marketing: "Produk marketing",
  kiriman_masuk: "Penerimaan kiriman",
  transfer_masuk: "Transfer masuk",
  transfer_keluar: "Transfer keluar",
};
export const saldoHitung = (r: StokRingkas) =>
  Number(r.awal) +
  Number(r.masuk) -
  Number(r.pakai) +
  Number(r.kembali) -
  Number(r.waste) -
  Number(r.marketing) +
  Number(r.so) +
  Number(r.koreksi) -
  Number(r.keluar_lain);
export function periodeStok(
  awal: string | undefined,
  akhir: string | undefined,
  hari: string,
) {
  const valid = (v: string | undefined) =>
    !!v &&
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    !Number.isNaN(Date.parse(v + "T00:00:00Z")) &&
    new Date(v + "T00:00:00Z").toISOString().slice(0, 10) === v;
  let a = valid(awal) ? awal! : hari.slice(0, 7) + "-01";
  let b = valid(akhir) ? akhir! : hari;
  if (b > hari) b = hari;
  if (a > b) a = b;
  if (Date.parse(b) - Date.parse(a) > 365 * 86400000)
    a = new Date(Date.parse(b) - 365 * 86400000).toISOString().slice(0, 10);
  return { awal: a, akhir: b };
}
