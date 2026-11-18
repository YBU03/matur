export type ItemKoreksi = {
  id?: string;
  menu_id: string;
  nama?: string;
  qty: number;
  harga: number;
  varian_ids: string[];
};
export type TransaksiKoreksi = {
  id: string;
  nomor: number;
  created_at: string;
  total: number;
  diskon: number;
  kanal: string;
  status: string;
  sesi_kas_id: string;
  koreksi_penjualan?: { jam_pasti?: boolean } | null;
};
export type RincianPenjualan = {
  transaksi: TransaksiKoreksi;
  sidik: string;
  items: ItemKoreksi[];
  bayar: { metode: string; nominal: number }[];
  riwayat: {
    waktu: string;
    aksi: string;
    nama: string;
    lama?: { transaksi?: TransaksiKoreksi; items?: ItemKoreksi[] };
    baru: {
      alasan?: string;
      data?: { transaksi?: TransaksiKoreksi; items?: ItemKoreksi[] };
    };
  }[];
};
export type PermintaanPenjualan = {
  request_id: string;
  pratinjau?: boolean;
  sidik_preview?: string;
  aksi: "tambah" | "edit" | "hapus" | "pulihkan";
  outlet_id: string;
  id?: string;
  sidik?: string;
  sesi_id?: string;
  tanggal?: string;
  jam?: string;
  jam_pasti?: boolean;
  kanal?: string;
  metode?: string;
  diskon?: number;
  items?: ItemKoreksi[];
  alasan: string;
};
export function totalKoreksi(items: ItemKoreksi[], diskon = 0) {
  return items.reduce((sum, i) => sum + i.qty * i.harga, 0) - diskon;
}

export type PreviewPenjualan = {
  sidik_preview: string;
  kas_sebelum: {
    setoran: number | null;
    seharusnya: number;
    selisih: number | null;
  };
  kas_sesudah: {
    setoran: number | null;
    seharusnya: number;
    selisih: number | null;
  };
  stok_dilewati_so: string[];
};
