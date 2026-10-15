// Hari libur yang tampil di kalender (gaya Makaryo): pada tanggal yang sudah disusun jadwalnya,
// staf yang tidak mendapat shift dan tidak sedang izin/sakit dianggap LIBUR. Murni & bisa diuji.

type J = { pengguna_id: string; tanggal: string };
type I = { pengguna_id: string; tanggal: string; jenis: string; status?: string };

/** Peta tanggal → id staf yang libur. Tanggal tanpa jadwal sama sekali (belum disusun) dilewati. */
export function hariLibur(stafIds: string[], jadwal: J[], izin: I[] = []) {
  const kerja = new Map<string, Set<string>>();
  for (const j of jadwal) {
    if (!kerja.has(j.tanggal)) kerja.set(j.tanggal, new Set());
    kerja.get(j.tanggal)!.add(j.pengguna_id);
  }
  const izinKey = new Set(izin.filter((i) => !i.status || i.status === "disetujui").filter((i) => i.jenis !== "libur").map((i) => `${i.pengguna_id}|${i.tanggal}`));
  const out = new Map<string, string[]>();
  for (const [tgl, ada] of kerja) {
    const libur = stafIds.filter((id) => !ada.has(id) && !izinKey.has(`${id}|${tgl}`));
    if (libur.length) out.set(tgl, libur);
  }
  // libur yang diajukan & disetujui tetap tampil walau tanggalnya belum disusun jadwalnya
  for (const i of izin) {
    if (i.jenis !== "libur" || (i.status && i.status !== "disetujui") || !stafIds.includes(i.pengguna_id)) continue;
    const xs = out.get(i.tanggal) ?? [];
    if (!xs.includes(i.pengguna_id)) out.set(i.tanggal, [...xs, i.pengguna_id]);
  }
  return out;
}

/** Rekap libur per staf dalam satu periode: tanggal-tanggalnya & jumlahnya. */
export function rekapLibur(stafIds: string[], jadwal: J[], izin: I[] = []) {
  const per = new Map<string, string[]>(stafIds.map((id) => [id, []]));
  for (const [tgl, ids] of [...hariLibur(stafIds, jadwal, izin)].sort((a, b) => a[0].localeCompare(b[0]))) for (const id of ids) per.get(id)!.push(tgl);
  return per;
}
