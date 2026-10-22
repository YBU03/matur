/** Pindah satu kegiatan tanpa mengubah susunan relatif kegiatan lainnya. */
export function pindahKegiatan(ids: string[], id: string, tujuan: number): string[] {
  const dari = ids.indexOf(id);
  if (dari < 0 || !Number.isInteger(tujuan)) return ids;
  const ke = Math.max(0, Math.min(ids.length - 1, tujuan));
  if (ke === dari) return ids;
  const hasil = [...ids];
  hasil.splice(ke, 0, ...hasil.splice(dari, 1));
  return hasil;
}

/** Indeks sisip berdasarkan baris lain; baris asal tidak ikut menghitung posisi tujuan. */
export function tujuanGeser(y: number, baris: { id: string; tengah: number }[], aktif: string): number {
  return baris.filter((b) => b.id !== aktif && y > b.tengah).length;
}
