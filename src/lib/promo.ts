export type AturanPromo = {
  menu_id: string;
  varian_ids: string[];
  jenis: "persen" | "potongan" | "harga_akhir" | "gratis";
  nilai: number;
};
export type Promo = {
  id: string;
  nama: string;
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
};
export type PromoQuote = {
  id: string;
  nama: string;
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
  diskon: number;
  subsidi?: boolean;
  nama_subsidi?: string;
  subtotal: number;
  total: number;
  status: string;
  qty: number;
};
