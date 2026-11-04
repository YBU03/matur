import type { Belanja, BelanjaBayar } from "./belanja-proyek";

const rapi = (s: string) => s.trim().replace(/\s+/g, " ");
const kunci = (s: string) => rapi(s).toLocaleLowerCase("id-ID");
const unik = (nilai: (string | null | undefined)[], pemisah: string) => {
  const hasil = new Map<string, string>();
  for (const nilaiAsli of nilai) {
    if (!nilaiAsli?.trim()) continue;
    const teks = rapi(nilaiAsli);
    if (!hasil.has(kunci(teks))) hasil.set(kunci(teks), teks);
  }
  return [...hasil.values()].join(pemisah);
};

/** Hanya proyeksi cetak. Catatan asli, tautan RAB dan pembayaran tidak diubah. */
export function kelompokNotaPdf(belanja: Belanja[]) {
  const kelompok = new Map<string, Belanja[]>();
  for (const b of belanja) {
    const key = JSON.stringify([
      b.proyek_id,
      kunci(b.toko),
      b.tanggal,
      kunci(b.nomor_nota ?? ""),
      !!b.nota_dp,
      b.batal_at ? b.id : "aktif",
    ]);
    kelompok.set(key, [...(kelompok.get(key) ?? []), b]);
  }
  return [...kelompok.values()].map((asal) => ({
    jumlahCatatan: asal.length,
    nota: {
      ...asal[0],
      toko: rapi(asal[0].toko),
      nomor_nota: asal[0].nomor_nota?.trim() || null,
      penanggung_jawab: unik(
        asal.map((b) => b.penanggung_jawab.replace(/\s*&\s*/g, " dan ")),
        " / ",
      ),
      nama_pencatat: unik(
        asal.map((b) => b.nama_pencatat),
        " / ",
      ),
      catatan:
        unik(
          asal.map((b) => b.catatan),
          "\n",
        ) || null,
      total: asal.reduce((s, b) => s + Number(b.total), 0),
      items: asal.flatMap((b) => b.items),
      pembayaran: asal.flatMap((b) => b.pembayaran),
    } satisfies Belanja,
  }));
}

/** Tanggal, sumber dan metode berbeda tetap terpisah; koreksi selalu ditampilkan sendiri. */
export function kelompokPembayaranPdf(
  pembayaran: BelanjaBayar[],
): BelanjaBayar[] {
  const kelompok = new Map<string, BelanjaBayar[]>();
  for (const p of pembayaran) {
    const key = JSON.stringify([
      p.tanggal,
      p.sumber,
      p.metode,
      p.batal_at ? p.id : "aktif",
    ]);
    kelompok.set(key, [...(kelompok.get(key) ?? []), p]);
  }
  return [...kelompok.values()]
    .map((asal) => ({
      ...asal[0],
      jumlah: asal.reduce((s, p) => s + Number(p.jumlah), 0),
      catatan:
        unik(
          asal.map((p) => p.catatan),
          "\n",
        ) || null,
      nama_pencatat: unik(
        asal.map((p) => p.nama_pencatat),
        " / ",
      ),
    }))
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal));
}
