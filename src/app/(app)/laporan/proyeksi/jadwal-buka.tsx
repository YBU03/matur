"use client";

// Panel Accounting: pilih tanggal & jam buka laporan untuk Mitra (WIB) + pratinjau tampilan di sisi Mitra.
import { useEffect, useState } from "react";

const JAM = ["08:00", "09:00", "10:00", "13:00", "16:00"];
export const BATAS_DETIK_JAM = 6; // hitung mundur per detik hanya tampil di 6 jam terakhir
const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

/** "2026-12-05T09:00" (WIB) → epoch ms */
const msDari = (v: string) => (v && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) ? Date.parse(`${v}:00+07:00`) : NaN);
const wibHariIni = (geser = 0) => new Date(Date.now() + 7 * 3600_000 + geser * 86400_000).toISOString().slice(0, 10);

export function teksTanggalWib(v: string) {
  const ms = msDari(v);
  if (!Number.isFinite(ms)) return "";
  const d = new Date(ms + 7 * 3600_000);
  return `${HARI[d.getUTCDay()]}, ${d.getUTCDate()} ${BULAN[d.getUTCMonth()]} ${d.getUTCFullYear()} · ${v.slice(11, 16).replace(":", ".")} WIB`;
}

export function sisaWaktu(ms: number) {
  if (ms <= 0) return "sudah lewat";
  const menit = Math.ceil(ms / 60000);
  const hari = Math.floor(menit / 1440), jam = Math.floor((menit % 1440) / 60), m = menit % 60;
  if (hari) return `${hari} hari${jam ? ` ${jam} jam` : ""} lagi`;
  if (jam) return `${jam} jam${m ? ` ${m} menit` : ""} lagi`;
  return `${m} menit lagi`;
}

export function JadwalBuka({ value, onChange, status }: { value: string; onChange: (v: string) => void; status: { teks: string; warna: string } }) {
  const [kini, setKini] = useState<number | null>(null);
  useEffect(() => {
    setKini(Date.now());
    const t = setInterval(() => setKini(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const tanggal = value.slice(0, 10);
  const jam = value.slice(11, 16) || "09:00";
  const ms = msDari(value);
  const sisa = kini !== null && Number.isFinite(ms) ? ms - kini : null;
  const lewat = sisa !== null && sisa <= 0;
  const bulanDepan = (() => {
    const d = new Date(`${wibHariIni()}T00:00:00Z`);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 5)).toISOString().slice(0, 10);
  })();
  const cepat: [string, string][] = [
    ["Besok 09.00", `${wibHariIni(1)}T09:00`],
    ["Tgl 5 bulan depan 09.00", `${bulanDepan}T09:00`],
    ["Tgl 10 bulan depan 09.00", `${bulanDepan.slice(0, 8)}10T09:00`],
  ];
  const chip = (aktif: boolean) =>
    `rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${aktif ? "bg-kopi-900 text-white" : "bg-white text-kopi-700 ring-1 ring-matur-200 hover:ring-matur-400"}`;

  return (
    <section className="space-y-3 rounded-2xl border border-matur-200 bg-gradient-to-b from-matur-50/60 to-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="mr-auto font-bold text-kopi-900">🔒 Jadwal buka laporan untuk Mitra</h3>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${status.warna}`}>{status.teks}</span>
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Pilihan cepat">
        {cepat.map(([l, v]) => (
          <button key={l} type="button" onClick={() => onChange(v)} className={chip(value === v)}>
            {l}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="block text-xs font-semibold text-stone-600">
          Tanggal buka
          <input
            id="jadwal-buka-tanggal"
            type="date"
            value={tanggal}
            onChange={(e) => onChange(e.target.value ? `${e.target.value}T${jam}` : "")}
            className="mt-1 w-full rounded-xl border border-matur-200 bg-white px-3 py-2 text-sm font-semibold text-kopi-900 outline-none focus:border-matur-500 focus:ring-2 focus:ring-matur-100"
          />
        </label>
        <div className="text-xs font-semibold text-stone-600">
          Jam buka (WIB)
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {JAM.map((j) => (
              <button key={j} type="button" disabled={!tanggal} onClick={() => onChange(`${tanggal}T${j}`)} className={`${chip(tanggal !== "" && jam === j)} disabled:opacity-40`}>
                {j.replace(":", ".")}
              </button>
            ))}
            <input
              id="jadwal-buka-jam"
              type="time"
              aria-label="Jam lain"
              value={tanggal ? jam : ""}
              disabled={!tanggal}
              onChange={(e) => e.target.value && onChange(`${tanggal}T${e.target.value}`)}
              className="w-28 rounded-lg border border-matur-200 bg-white px-2 py-1.5 text-xs disabled:opacity-40"
            />
          </div>
        </div>
      </div>

      {value && Number.isFinite(ms) ? (
        <div className={`rounded-xl p-3 text-sm ${lewat ? "bg-amber-50 text-amber-900 ring-1 ring-amber-200" : "bg-white ring-1 ring-matur-100"}`}>
          <p>
            Mitra bisa membuka laporan <b className="text-kopi-900">{teksTanggalWib(value)}</b>
            {sisa !== null && <span className={lewat ? "font-semibold" : "text-matur-700"}> · {lewat ? "waktu ini sudah lewat — laporan langsung terbuka setelah disetujui" : sisaWaktu(sisa)}</span>}
          </p>
          <p className="mt-1 text-[11px] text-stone-500">
            Di sisi Mitra: tampil gembok + tanggal buka. Hitung mundur per detik muncul {BATAS_DETIK_JAM} jam sebelum waktu buka. Laporan terbuka hanya bila sudah disetujui dan waktunya tiba.
          </p>
        </div>
      ) : (
        <p className="rounded-xl bg-white px-3 py-2 text-xs text-stone-500 ring-1 ring-matur-100">Belum ada jadwal. Pilih tanggal dan jam, atau gunakan pilihan cepat di atas. Jadwal wajib diisi sebelum menyetujui untuk Mitra.</p>
      )}
      {value && (
        <button type="button" onClick={() => onChange("")} className="text-xs font-semibold text-stone-500 underline">
          Kosongkan jadwal
        </button>
      )}
    </section>
  );
}
