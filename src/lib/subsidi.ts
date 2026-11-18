export type PembayaranSubsidi = {
  id: string;
  tanggal: string;
  jumlah: number;
  bukti: string;
  catatan: string;
  batal_at: string | null;
  alasan_batal?: string | null;
};
export type RiwayatSubsidi = {
  waktu: string;
  aksi: string;
  pengguna: string | null;
  nilai_lama: Record<string, unknown> | null;
  nilai_baru: Record<string, unknown> | null;
};
export type TagihanSubsidi = {
  id: string;
  transaksi_id: string;
  outlet_id: string;
  outlet: string;
  tanggal: string;
  waktu: string;
  nomor: number;
  nama: string;
  nominal_awal: number;
  nominal: number;
  target: number;
  terbayar: number;
  pelanggan_bayar: number;
  status_transaksi: string;
  catatan: string;
  versi: number;
  items: { nama: string; qty: number; harga: number }[];
  pembayaran: PembayaranSubsidi[];
  riwayat: RiwayatSubsidi[];
};
export type MarketingDiskon = {
  cakupan?: "item" | "transaksi";
  id: string;
  nomor: number;
  waktu: string;
  tanggal: string;
  outlet: string;
  status: string;
  nama: string;
  nama_subsidi?: string;
  subtotal: number;
  total: number;
  diskon: number;
  subsidi: number;
  manual: number;
  operator: string | null;
  catatan?: string | null;
  alasan_void?: string | null;
  items: { nama: string; qty: number; harga: number }[];
};
export function ringkasSubsidi(rows: TagihanSubsidi[]) {
  return rows.reduce(
    (s, r) => ({
      tagihan: s.tagihan + Number(r.target),
      dibayar: s.dibayar + Number(r.terbayar),
      sisa: s.sisa + Math.max(Number(r.target) - Number(r.terbayar), 0),
      lebih: s.lebih + Math.max(Number(r.terbayar) - Number(r.target), 0),
    }),
    { tagihan: 0, dibayar: 0, sisa: 0, lebih: 0 },
  );
}
