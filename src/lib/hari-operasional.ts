// Hari operasional outlet: penjualan sebelum jam tutup buku (03.00 WIB) masih masuk hari sebelumnya.
// Berlaku mulai hari operasional TUTUP_BUKU_MULAI; sebelum itu (termasuk data dokumen PDF 1 Nov) tetap tanggal kalender.
// Sama dengan fungsi DB public.tgl_op / public.awal_op (perusahaan.jam_tutup_buku & tutup_buku_mulai).
export const JAM_TUTUP_BUKU = 3;
export const TUTUP_BUKU_MULAI = "2026-11-02";
const MULAI_MS = Date.parse(`${TUTUP_BUKU_MULAI}T00:00:00+07:00`);

/** Tanggal operasional (YYYY-MM-DD) dari suatu waktu; bawaan: sekarang. */
export function tglOperasional(waktu: Date | string | number = new Date()) {
  const t = typeof waktu === "string" ? Date.parse(waktu) : waktu instanceof Date ? waktu.getTime() : waktu;
  const geser = t < MULAI_MS ? 7 : 7 - JAM_TUTUP_BUKU;
  return new Date(t + geser * 3600_000).toISOString().slice(0, 10);
}

/** Awal hari operasional sebagai ISO WIB, mis. "2026-11-02T03:00:00+07:00" (sebelum TUTUP_BUKU_MULAI: jam 00.00). */
export const awalOperasional = (tgl: string) =>
  `${tgl}T${tgl < TUTUP_BUKU_MULAI ? "00" : String(JAM_TUTUP_BUKU).padStart(2, "0")}:00:00+07:00`;
