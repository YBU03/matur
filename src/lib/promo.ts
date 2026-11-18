export type AturanPromo = {
  menu_id: string;
  varian_ids: string[];
  jenis: "persen" | "potongan" | "harga_akhir" | "gratis";
  nilai: number;
};
export type Promo = {
  id: string;
  nama: string;
  cakupan?: "item" | "transaksi";
  nilai_voucher?: number | null;
  minimum_belanja?: number;
  aktif: boolean;
  subsidi?: boolean;
  nama_subsidi?: string;
  mulai: string;
  selesai: string;
  jam_mulai: string;
  jam_selesai: string;
  semua_outlet: boolean;
  outlet_ids: string[];
  aturan: AturanPromo[];
  kuota: number | null;
  per_menu: boolean;
  bersama: boolean;
  boleh_manual: boolean;
  versi: number;
  /** slot jam bebas (boleh lewat tengah malam); kosong = jam_mulai–jam_selesai */
  slot?: SlotPromo[];
  /** hari ISO 1=Senin … 7=Minggu; kosong = setiap hari */
  hari?: number[];
  /** hanya dari daftar kasir: akhir slot yang sedang berlaku & sisa kuota hari ini */
  berakhir_at?: string | null;
  sisa_kuota?: Record<string, number> | null;
};
export type SlotPromo = { mulai: string; selesai: string };
export type KuotaPromoHarian = { tanggal: string; promo_id: string; promo: string; outlet: string; menu: string | null; kuota: number; terpakai: number; habis_at: string | null };
export type PromoQuote = {
  id: string;
  /** id promo yang dipilih kasir (diisi klien) untuk tampilan harga coret per menu */
  promo_id?: string;
  nama: string;
  cakupan?: "item" | "transaksi";
  nilai_voucher?: number | null;
  minimum_belanja?: number;
  diskon: number;
  subsidi?: boolean;
  nama_subsidi?: string;
  subtotal: number;
  sampai_at: string;
  sisa: Record<string, number>;
};
export type PromoSnapshot = {
  id: string;
  nama: string;
  cakupan?: "item" | "transaksi";
  nilai_voucher?: number | null;
  minimum_belanja?: number;
  diskon: number;
  subsidi?: boolean;
  nama_subsidi?: string;
  versi: number;
};
export type PemakaianPromo = {
  id: string;
  nomor: number;
  waktu: string;
  tanggal: string;
  outlet: string;
  promo: string;
  cakupan?: "item" | "transaksi";
  diskon: number;
  subsidi?: boolean;
  nama_subsidi?: string;
  subtotal: number;
  total: number;
  status: string;
  qty: number;
};
