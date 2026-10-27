import type { Kiriman } from "./kiriman";
import type { Kop } from "./pdf-kop";

// Kotak tanda tangan dokumen gudang (modul ringan, aman diimpor di klien tanpa jsPDF).
/** isi satu kotak tanda tangan; semua bebas diedit/dikosongkan saat cetak */
export type KotakTtd = { judul: string; nama: string; tanggal: string };
export const JUDUL_TTD = ["Dibuat oleh", "Diperiksa oleh", "Dikirim oleh", "Diterima oleh"];
export const TANGGAL_TTD = "Tanggal: ................";
/** isian awal 4 kotak: judul dari pengaturan, nama dari data kiriman */
export function kotakTtdAwal(k: Kiriman, pt: Kop): KotakTtd[] {
  const nama = [k.pembuat_nama, k.pemeriksa_nama, k.pengirim, k.nama_penerima];
  return JUDUL_TTD.map((j, i) => ({
    judul: pt.judul_ttd?.[i] ?? j,
    nama: nama[i] ?? "",
    tanggal: TANGGAL_TTD,
  }));
}
