export const SUMBER_BELANJA = { dana_proyek: "Dana proyek (pusat)", talangan_pusat: "Talangan pusat", langsung_mitra: "Dibayar langsung mitra" } as const;
export type SumberBelanja = keyof typeof SUMBER_BELANJA;
export type BelanjaItem = { id: string; belanja_id: string; item_rab_id: string | null; nama: string; kategori: string; satuan: string | null; qty: number; harga_satuan: number; jumlah: number; urutan: number };
export type BelanjaBayar = { id: string; belanja_id: string; tanggal: string; jumlah: number; sumber: SumberBelanja; metode: string; catatan: string | null; nama_pencatat: string };
export type Belanja = { id: string; proyek_id: string; tanggal: string; toko: string; nomor_nota: string | null; penanggung_jawab: string; catatan: string | null; nota_path: string | null; nota_url?: string; total: number; nama_pencatat: string; updated_at: string; batal_at: string | null; alasan_batal: string | null; items: BelanjaItem[]; pembayaran: BelanjaBayar[] };
export type BarangInput = { item_rab_id: string | null; nama: string; kategori: string; satuan: string; qty: string; harga_satuan: string };
export type BelanjaInput = { tanggal: string; toko: string; nomor_nota: string; penanggung_jawab: string; catatan: string; nota_path: string | null; items: BarangInput[]; pembayaran?: { id: string; tanggal: string; jumlah: string; sumber: SumberBelanja; metode: string; catatan: string } };

export function jumlahBarang(qty: string | number, harga: string | number) {
  return Math.floor((Math.round(Number(qty) * 1000) * Number(harga) + 500) / 1000);
}
export function terbayar(b: Pick<Belanja, "pembayaran">) {
  return b.pembayaran.reduce((s, p) => s + Number(p.jumlah), 0);
}
export function statusBelanja(b: Pick<Belanja, "total" | "pembayaran" | "batal_at">) {
  return b.batal_at ? "Dibatalkan" : terbayar(b) >= b.total ? "Lunas" : terbayar(b) > 0 ? "Sebagian" : "Belum dibayar";
}
export function ringkasanBelanja(belanja: Belanja[], realisasiLama: number, danaMasuk: number) {
  const aktif = belanja.filter((b) => !b.batal_at);
  const total = aktif.reduce((s, b) => s + Number(b.total), 0);
  const bayar = aktif.flatMap((b) => b.pembayaran);
  const dariProyek = bayar.filter((p) => p.sumber === "dana_proyek").reduce((s, p) => s + Number(p.jumlah), 0);
  return { realisasi: Number(realisasiLama) + total, nota: total, dibayar: bayar.reduce((s, p) => s + Number(p.jumlah), 0), tagihan: aktif.reduce((s, b) => s + Number(b.total) - terbayar(b), 0), dariProyek, saldo: Number(danaMasuk) - dariProyek, talangan: bayar.filter((p) => p.sumber === "talangan_pusat").reduce((s, p) => s + Number(p.jumlah), 0), mitra: bayar.filter((p) => p.sumber === "langsung_mitra").reduce((s, p) => s + Number(p.jumlah), 0) };
}
/** Kolom lama tetap disimpan terpisah; total tampilan saja yang ditambah nota. */
export function gabungRealisasiRab<T extends { id: string; harga_realisasi: number | null }>(rab: T[], belanja: Belanja[]) {
  const amounts = new Map<string, number>();
  for (const b of belanja) if (!b.batal_at) for (const i of b.items) if (i.item_rab_id) amounts.set(i.item_rab_id, (amounts.get(i.item_rab_id) ?? 0) + Number(i.jumlah));
  return rab.map((r) => ({ ...r, realisasi_lama: Number(r.harga_realisasi ?? 0), harga_realisasi: Number(r.harga_realisasi ?? 0) + (amounts.get(r.id) ?? 0) }));
}
export function belanjaDiLuarRab(belanja: Belanja[], rabIds: string[]) {
  const ids = new Set(rabIds);
  return belanja.filter((b) => !b.batal_at).flatMap((b) => b.items).filter((i) => !i.item_rab_id || !ids.has(i.item_rab_id)).reduce((s, i) => s + Number(i.jumlah), 0);
}
