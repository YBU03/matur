/** Filters only help build an explicit list of menu IDs; never evaluate live promo scope. */
export type MenuPromo = {
  id: string;
  nama: string;
  kategori_id?: string | null;
  penyajian?: string | null;
  jenis_kemasan?: string | null;
  kemasan?: string | null;
  harga_langsung?: number | null;
  harga_ojol?: number | null;
};
export type FilterMenuPromo = { kategori: string; penyajian: string; kemasan: string; cari: string };
export function saringMenuPromo(menus: MenuPromo[], f: FilterMenuPromo) {
  const q = f.cari.trim().toLocaleLowerCase("id-ID");
  return menus.filter((m) =>
    (!f.kategori || m.kategori_id === f.kategori) &&
    (!f.penyajian || (f.penyajian === "kosong" ? !m.penyajian : m.penyajian === f.penyajian)) &&
    (!f.kemasan || (f.kemasan === "kosong" ? !m.jenis_kemasan : m.jenis_kemasan === f.kemasan)) &&
    (!q || `${m.nama} ${m.kemasan ?? ""} ${m.jenis_kemasan ?? ""} ${m.penyajian ?? ""}`.toLocaleLowerCase("id-ID").includes(q)),
  );
}
export const labelPenyajian = (v?: string | null) => ({ ice: "Ice", hot: "Hot", tanpa: "Tanpa pilihan suhu" })[v ?? ""] ?? "Belum ditentukan";
