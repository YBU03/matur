// Hari operasional outlet: penjualan sebelum jam tutup buku (03.00 WIB) masih masuk hari sebelumnya.
// Sama dengan fungsi DB public.tgl_op / public.awal_op (kolom perusahaan.jam_tutup_buku, bawaan 3).
export const JAM_TUTUP_BUKU = 3;

/** Tanggal operasional (YYYY-MM-DD) dari suatu waktu; bawaan: sekarang. */
export function tglOperasional(waktu: Date | string | number = new Date()) {
  const t = typeof waktu === "string" ? Date.parse(waktu) : waktu instanceof Date ? waktu.getTime() : waktu;
  return new Date(t + (7 - JAM_TUTUP_BUKU) * 3600_000).toISOString().slice(0, 10);
}

/** Awal hari operasional sebagai ISO WIB, mis. "2026-11-02T03:00:00+07:00". */
export const awalOperasional = (tgl: string) => `${tgl}T${String(JAM_TUTUP_BUKU).padStart(2, "0")}:00:00+07:00`;
