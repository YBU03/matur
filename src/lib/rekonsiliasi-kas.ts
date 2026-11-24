export type BiayaKas = {
  tanggal_sesuai?: boolean;
  id: string;
  tanggal: string;
  jumlah: number;
  sumber: "laci" | "pusat";
  keterangan: string | null;
  sesi_kas_id: string | null;
  tanggal_shift: string | null;
  sidik: string;
  dilindungi: boolean;
};
export type NilaiKas = {
  id: string;
  tanggal: string;
  setoran: number | null;
  seharusnya: number;
  selisih: number | null;
};
export type PratinjauKas = {
  sidik: string;
  sebelum: NilaiKas[];
  sesudah: NilaiKas[];
  tersimpan: boolean;
};
export type KoreksiKas = {
  id: string;
  tanggal: string;
  jumlah: number;
  sumber: string;
  sesi_id: string | null;
  sidik_biaya: string;
  alasan?: string;
  sidik?: string;
  simpan?: boolean;
};
export type PemeriksaanKas = {
  transaksi_tunai?: {
    id: string;
    nomor: number;
    created_at: string;
    nominal: number;
  }[];
  tunai_terpotong?: boolean;
  revisi_aktual?: import("@/components/revisi-aktual-kas").RevisiKas[];
  sesi: {
    tanggal_shift?: string;
    dibuka_at?: string;
    ditutup_at?: string | null;
    outlet_id?: string;
    id: string;
    modal_laci: number;
    setoran: number | null;
    seharusnya: number | null;
    selisih: number | null;
    pos_tim: boolean;
    fisik_akhir: number | null;
  };
  tanggal: string;
  hitung: { tunai: number; laci: number; keluar: number; seharusnya: number };
  biaya: BiayaKas[];
  pilihan: {
    id: string;
    tanggal: string;
    nama: string | null;
    dibuka_at: string;
    ditutup_at: string | null;
    tanggal_terkait?: string[] | null;
  }[];
  riwayat: {
    waktu: string;
    nama?: string;
    alasan: string;
    lama: unknown;
    baru: unknown;
  }[];
  penyerahan: { jumlah: number; data: Record<string, unknown> }[];
};
export function masalahBiaya(
  b: Pick<
    BiayaKas,
    "sumber" | "sesi_kas_id" | "tanggal_shift" | "tanggal" | "tanggal_sesuai"
  >,
) {
  if (b.sumber !== "laci") return null;
  if (!b.sesi_kas_id) return "Belum terhubung ke shift";
  if (b.tanggal_sesuai !== true && b.tanggal_shift !== b.tanggal)
    return "Tanggal pengeluaran berbeda dari tanggal shift";
  return null;
}
export function alasanTransaksi(kanal: string, metode: string) {
  const platform = ["gofood", "grabfood", "shopeefood", "tiktok", "ruma_app"];
  if (kanal === "langsung" && platform.includes(metode))
    return `Asal pesanan langsung, tetapi pembayaran tercatat melalui ${metode}. Cocokkan dengan bukti pembayaran.`;
  if (platform.includes(kanal) && metode !== kanal)
    return `Asal pesanan ${kanal}, tetapi pembayaran tercatat ${metode}. Cocokkan dengan dashboard platform atau bukti pembayaran.`;
  return null;
}
