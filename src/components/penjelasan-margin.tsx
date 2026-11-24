import {
  CATATAN_MARGIN,
  marginPresisi,
  pembulatanMargin,
  rupiahEfekMargin,
} from "@/lib/pembulatan-margin";
import { persenLaba, rupiahLaporan } from "@/lib/laporan-rekap";
export function PenjelasanMargin({
  omzet,
  laba,
  label = "Penjelasan pembulatan margin",
}: {
  omzet: number;
  laba: number;
  label?: string;
}) {
  const p = pembulatanMargin(omzet, laba);
  return (
    <details className="font-normal">
      <summary
        className="cursor-pointer whitespace-nowrap font-semibold text-kopi-900 underline decoration-dotted underline-offset-4"
        aria-label={label}
      >
        {persenLaba(p.asli)} <span className="text-xs text-stone-500">ⓘ</span>
      </summary>
      <div className="mt-2 w-72 max-w-[75vw] space-y-2 rounded-xl border border-matur-200 bg-matur-50 p-3 text-xs text-stone-700">
        <h3 className="font-bold">{label}</h3>
        <dl className="space-y-2">
          {[
            ["Omzet sesuai laporan", rupiahLaporan(omzet)],
            ["Laba bersih sesuai laporan", rupiahLaporan(laba)],
            [
              "Margin sebelum pembulatan (hingga 12 desimal)",
              marginPresisi(p.asli),
            ],
            ["Margin tampilan · 2 desimal", persenLaba(p.tampilan)],
            [
              "Hitung balik omzet × margin tampilan",
              rupiahEfekMargin(p.hitungBalik),
            ],
            ["Selisih hitung balik − laba asli", rupiahEfekMargin(p.selisih)],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-stone-500">{k}</dt>
              <dd className="font-semibold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        <p>
          {p.asli === null
            ? "Margin tidak dihitung karena omzet nol."
            : CATATAN_MARGIN}
        </p>
        <p className="text-stone-500">
          Laba asli adalah acuan. Selisih positif berarti hitung balik lebih
          besar; negatif berarti lebih kecil. Nilai hitung balik dan selisih
          ditampilkan hingga 2 desimal rupiah.
        </p>
      </div>
    </details>
  );
}
