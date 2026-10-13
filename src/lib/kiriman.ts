// Label & warna status kiriman bahan (dipakai di server & browser)
export const STATUS_KIRIMAN: Record<string, [string, string]> = {
  draft: ["Draft", "bg-stone-100 text-stone-700"],
  dikirim: ["Dalam perjalanan", "bg-amber-100 text-amber-800"],
  diterima: ["Diterima", "bg-green-100 text-green-800"],
  batal: ["Batal", "bg-red-50 text-red-600"],
};

export type ItemKiriman = { id: string; bahan_id: string; nama: string; satuan: string | null; konversi: number; qty: number; harga: number; qty_diterima: number | null };
export type Kiriman = {
  id: string;
  nomor: string;
  tanggal: string;
  status: "draft" | "dikirim" | "diterima" | "batal";
  catatan: string | null;
  pengirim: string | null;
  total: number;
  dikirim_at: string | null;
  diterima_at: string | null;
  nama_penerima: string | null;
  outlet: { nama: string; alamat: string | null } | null;
};
