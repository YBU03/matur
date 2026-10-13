// Penerimaan seorang mitra/investor dari laporan bulanan: transfer (bagi hasil, sewa) yang atas nama / keterangannya
// cocok dengan nama mitra; bila bulan itu tak ada transfer yang cocok, pakai baris bagi hasil. Murni & bisa diuji.
import type { Laporan } from "./laporan";

const norm = (s: string | null | undefined) =>
  (s ?? "")
    .toLowerCase()
    .replace(/\b(ibu|bapak|bpk|bu|pak|sdr|sdri)\.?\s+/g, "")
    .replace(/\s+/g, " ")
    .trim();
export const cocokNama = (teks: string | null | undefined, nama: string) => {
  const t = norm(teks), n = norm(nama);
  return !!n && n.length >= 3 && t.includes(n);
};

export type Penerimaan = { periode: string; rincian: { keterangan: string; jumlah: number; rekening: string | null }[]; total: number };

export function penerimaanMitra(laporan: Pick<Laporan, "periode" | "transfer" | "bagi_hasil">[], nama: string): Penerimaan[] {
  return laporan
    .map((l) => {
      let rincian = (l.transfer ?? [])
        .filter((t) => cocokNama(t.atas_nama, nama) || cocokNama(t.keterangan, nama))
        .map((t) => ({ keterangan: t.keterangan, jumlah: Number(t.jumlah) || 0, rekening: [t.bank, t.no_rekening].filter(Boolean).join(" ") || null }));
      if (!rincian.length)
        rincian = (l.bagi_hasil ?? []).filter((b) => cocokNama(b.nama, nama)).map((b) => ({ keterangan: `Bagi hasil ${b.persen}%`, jumlah: Number(b.jumlah) || 0, rekening: null }));
      return { periode: l.periode, rincian, total: rincian.reduce((s, r) => s + r.jumlah, 0) };
    })
    .filter((p) => p.rincian.length)
    .sort((a, b) => a.periode.localeCompare(b.periode));
}
