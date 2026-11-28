import Link from "next/link";
import { jumlahBahanTertulis } from "@/lib/keterangan-jumlah-bahan";

import { statusStokTertulis, type InfoStokBahan } from "@/lib/rincian-stok";
export { statusStokTertulis } from "@/lib/rincian-stok";
export type { InfoStokBahan } from "@/lib/rincian-stok";
/** Hanya menyajikan saldo; tidak mengubah data atau menyimpulkan stok fisik. */
export function RincianStokBahan({ info, riwayat }: { info: InfoStokBahan; riwayat: string }) {
  const { jumlah, satuan, satuanBeli, konversi, minimum } = info;
  const validKonversi = Number.isFinite(konversi) && Number(konversi) > 0 && !!satuanBeli;
  const satuanRancu = validKonversi && satuanBeli === satuan && konversi !== 1;
  return <details className="min-w-0 rounded-lg border border-amber-200 bg-white/70 p-2 text-xs">
    <summary className="cursor-pointer font-semibold text-kopi-900">
      {jumlah === null ? "Saldo belum tercatat" : `Sisa ${jumlahBahanTertulis(jumlah, satuan)}`} · {statusStokTertulis(jumlah, minimum)} <span className="font-normal underline">Rincian ▾</span>
    </summary>
    <div className="mt-2 space-y-2 leading-relaxed text-stone-700">
      <p><b>Stok sistem:</b> {jumlah === null ? "Belum ada catatan saldo bahan ini; bukan bukti stok fisik habis." : jumlahBahanTertulis(jumlah, satuan)}.</p>
      {validKonversi && <p><b>Isi per kemasan:</b> 1 {satuanBeli} = {jumlahBahanTertulis(Number(konversi), satuan)}.
        {jumlah !== null && !satuanRancu && <> <b>Setara:</b> ≈ {new Intl.NumberFormat("id-ID", { maximumSignificantDigits: 6 }).format(jumlah / Number(konversi))} {satuanBeli} (perkiraan).</>}
      </p>}
      {(!validKonversi || satuanRancu) && <p className="rounded bg-amber-50 p-2">Satuan/isi kemasan perlu diperiksa pada master bahan. Padanan kemasan tidak ditafsirkan otomatis; data asli tetap dipertahankan.</p>}
      <p><b>Batas minimum:</b> {jumlahBahanTertulis(minimum, satuan)} · {info.sumberMinimum ?? "sesuai pengaturan stok"}.</p>
      <p>{jumlah === null ? "Catat stok awal atau periksa riwayat penerimaan/SO." : jumlah < 0 ? "Saldo tercatat negatif, bukan nol. Periksa penerimaan, resep, waste dan penyesuaian SO sebelum melakukan koreksi." : jumlah === 0 ? "Saldo sistem nol. Pastikan dengan hitung fisik; angka ini bukan hasil hitung fisik terbaru." : jumlah <= minimum ? "Peringatan muncul karena saldo berada pada atau di bawah batas minimum." : "Saldo berada di atas batas minimum yang ditampilkan."}</p>
      <p>Stok masuk menambah saldo; resep POS dan waste mengurangi saldo. Void, koreksi dan SO dapat menyesuaikan saldo. Riwayat menjelaskan sumber perubahan; saldo sistem bukan jaminan jumlah fisik.</p>
      <Link className="inline-block rounded border border-matur-300 px-3 py-2 font-semibold text-matur-700" href={riwayat}>Lihat riwayat pergerakan · pilih periode →</Link>
    </div>
  </details>;
}
