"use client";

const bulan = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

// Nilai tetap YYYY-MM-DD untuk penyimpanan; pilihan tidak bergantung kalender browser.
export function TanggalBelanja({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (tanggal: string) => void;
}) {
  const [tahun, month, hari] = value.split("-").map(Number);
  const sekarang = new Date().getFullYear();
  const awal = Math.min(sekarang - 100, tahun);
  const akhir = Math.max(sekarang + 5, tahun);
  const jumlahHari = (y: number, m: number) => new Date(y, m, 0).getDate();
  const ubah = (y: number, m: number, d: number) =>
    onChange(
      `${y}-${String(m).padStart(2, "0")}-${String(Math.min(d, jumlahHari(y, m))).padStart(2, "0")}`,
    );
  const kelas =
    "mt-1 min-w-0 w-full rounded-lg border border-stone-300 bg-white px-2 py-2 text-sm focus-visible:outline-2 focus-visible:outline-matur-500 disabled:bg-stone-100";
  return (
    <fieldset className="min-w-0 text-sm">
      <legend>{label}</legend>
      <div className="grid grid-cols-[0.8fr_1.5fr_1fr] gap-2">
        <select
          aria-label={`${label}: tanggal`}
          className={kelas}
          value={hari}
          onChange={(e) => ubah(tahun, month, Number(e.target.value))}
        >
          {Array.from({ length: jumlahHari(tahun, month) }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {i + 1}
            </option>
          ))}
        </select>
        <select
          aria-label={`${label}: bulan`}
          className={kelas}
          value={month}
          onChange={(e) => ubah(tahun, Number(e.target.value), hari)}
        >
          {bulan.map((b, i) => (
            <option key={b} value={i + 1}>
              {b}
            </option>
          ))}
        </select>
        <select
          aria-label={`${label}: tahun`}
          className={kelas}
          value={tahun}
          onChange={(e) => ubah(Number(e.target.value), month, hari)}
        >
          {Array.from({ length: akhir - awal + 1 }, (_, i) => akhir - i).map(
            (y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ),
          )}
        </select>
      </div>
    </fieldset>
  );
}
