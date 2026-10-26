export type PilihanShift = {
  id: string;
  nama: string;
  foto_path: string | null;
  foto_url?: string;
  terjadwal: boolean;
  label: string;
};
export type ShiftBaru = {
  tim?: { id: string; nama: string }[];
  id: string;
  sesi_id: string;
  nama: string;
  label: string;
  mulai_at: string;
  selesai_at: string | null;
  awal: number;
  aktual: number | null;
  catatan: string;
  laporan: CatatanShift;
  tunai: number;
  non_tunai: number;
  jumlah: number;
  void: number;
  pengeluaran: number;
  keluar: number;
  seharusnya: number;
  selisih: number | null;
};
export type CatatanShift = {
  stok?: string;
  barang?: string;
  order?: string;
  non_tunai_aktual?: number;
  request_tutup?: string;
};
export type AturanShift = {
  id: string;
  nama: string;
  aktif: boolean;
  ada_pin: boolean;
  versi: number;
};
export type LaporanShift = {
  outlet: string;
  kas: {
    modal: number;
    tunai: number;
    non_tunai: number;
    laci: number;
    keluar: number;
    seharusnya: number;
  };
  sesi: {
    tanggal_shift: string;
    ditutup_at: string | null;
    fisik_akhir: number | null;
    selisih: number | null;
  };
  shifts: ShiftBaru[];
  pengeluaran: { keterangan: string; jumlah: number }[];
  kanal: Record<string, number>;
  barang_datang: {
    nomor: string;
    tanggal: string;
    status: string;
    items?: {
      nama: string;
      qty: number | null;
      satuan: string;
      catatan: string | null;
    }[];
  }[];
  sementara: boolean;
};
const uang = (n: number) => new Intl.NumberFormat("id-ID").format(n);
export function teksLaporanShift(r: LaporanShift) {
  const akhir = r.shifts.at(-1);
  const k = r.kas;
  return [
    `*${r.outlet.toUpperCase()}*`,
    r.sesi.tanggal_shift,
    r.sementara
      ? "Rekap sementara · menunggu sinkronisasi perangkat"
      : "Rekap kas",
    "",
    "Barista:",
    ...r.shifts.map(
      (s) =>
        `${s.tim?.length ? s.tim.map((p) => p.nama).join(", ") : s.nama} (${s.label}) · PIC ${s.nama}`,
    ),
    "",
    `Modal awal: Rp ${uang(k.modal)}`,
    `Omzet: Rp ${uang(k.tunai + k.non_tunai)}`,
    `Tunai: Rp ${uang(k.tunai)}`,
    `Non tunai: Rp ${uang(k.non_tunai)}`,
    `Pembatalan: ${r.shifts.reduce((n, s) => n + s.void, 0)}`,
    "",
    `Pengeluaran laci: Rp ${uang(k.laci)}`,
    ...r.pengeluaran.map(
      (p, i) => `${i + 1}. ${p.keterangan}: Rp ${uang(p.jumlah)}`,
    ),
    `Uang sudah diserahkan: Rp ${uang(k.keluar)}`,
    "",
    `Fisik laci termasuk modal: ${akhir?.aktual == null ? "Belum dihitung" : "Rp " + uang(akhir.aktual)}`,
    `Hasil tunai di luar modal: ${akhir?.aktual == null ? "Belum dihitung" : "Rp " + uang(akhir.aktual - k.modal)}`,
    `Non tunai aktual: ${akhir?.laporan.non_tunai_aktual == null ? "Belum diperiksa" : "Rp " + uang(akhir.laporan.non_tunai_aktual)}`,
    `Selisih tunai harian: ${r.sesi.selisih == null ? "Belum dihitung" : "Rp " + uang(r.sesi.selisih)}`,
    `Selisih non tunai: ${akhir?.laporan.non_tunai_aktual == null ? "Belum diperiksa" : "Rp " + uang(akhir.laporan.non_tunai_aktual - k.non_tunai)}`,
    "",
    ...r.shifts.map(
      (s) =>
        `Selisih ${s.nama} (${s.label}): ${s.selisih == null ? "Belum dihitung" : "Rp " + uang(s.selisih)}${s.catatan ? " · " + s.catatan : ""}`,
    ),
    "",
    ...["grab", "gofood", "shopee"].map(
      (x) =>
        `${x}: Rp ${uang(
          Object.entries(r.kanal)
            .filter(([key]) => key.toLowerCase().includes(x))
            .reduce((n, [, v]) => n + v, 0),
        )}`,
    ),
    "",
    "*Data Stok Akhir*",
    akhir?.laporan.stok || "Belum diisi",
    "",
    "*Barang Datang*",
    ...r.barang_datang.flatMap((b) => [
      `${b.nomor} · ${b.tanggal} · ${b.status}`,
      ...(b.items ?? []).map(
        (i) =>
          `- ${i.nama}: ${i.qty ?? "belum diperiksa"} ${i.satuan ?? ""}${i.catatan ? " (" + i.catatan + ")" : ""}`,
      ),
    ]),
    akhir?.laporan.barang || "",
    "",
    "*Order*",
    akhir?.laporan.order || "Belum diisi",
  ].join("\n");
}
