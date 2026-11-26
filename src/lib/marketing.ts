export type KatalogMarketing = {
  outlets: { id: string; nama: string }[];
  menus: {
    id: string;
    nama: string;
    kemasan: string | null;
    penyajian: string | null;
    jenis_kemasan: string | null;
    harga_langsung: number;
    harga_ojol: number;
    kategori_id: string | null;
  }[];
  variants: { id: string; nama: string; grup: string; menu_id: string }[];
  kategori: { id: string; nama: string }[];
};
export type ShiftMarketing = {
  id: string;
  outlet_id: string;
  outlet: string;
  nama: string;
  jabatan: string | null;
  shift: string;
  jam_mulai: string;
  jam_selesai: string;
};
export type JadwalMarketing = {
  tanggal: string;
  outlets: { id: string; nama: string }[];
  jadwal: ShiftMarketing[];
};
