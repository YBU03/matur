"use client";
// Kartu laporan bulanan di sisi Mitra: terkunci (tanggal buka), hitung mundur per detik hanya di 6 jam terakhir, lalu terbuka.
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { namaBulan } from "@/lib/laporan";
import { statusKunci, type PeriodeLaporan } from "@/lib/laporan-internal";

const ENAM_JAM = 6 * 3600_000;
const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function tanggalBuka(iso: string) {
  const d = new Date(Date.parse(iso) + 7 * 3600_000);
  const jam = `${String(d.getUTCHours()).padStart(2, "0")}.${String(d.getUTCMinutes()).padStart(2, "0")}`;
  return { hari: HARI[d.getUTCDay()], tanggal: `${d.getUTCDate()} ${BULAN[d.getUTCMonth()]} ${d.getUTCFullYear()}`, jam, ymd: d.toISOString().slice(0, 10) };
}
/** Keterangan santai untuk jadwal > 6 jam: "4 hari lagi", "besok pagi", "nanti malam". */
function kapan(buka: number, kini: number) {
  const hariKe = (ms: number) => Math.floor((ms + 7 * 3600_000) / 86400_000);
  const selisihHari = hariKe(buka) - hariKe(kini);
  const jam = new Date(buka + 7 * 3600_000).getUTCHours();
  const waktu = jam < 11 ? "pagi" : jam < 15 ? "siang" : jam < 18 ? "sore" : "malam";
  if (selisihHari <= 0) return `hari ini, ${waktu}`;
  if (selisihHari === 1) return `besok ${waktu}`;
  return `${selisihHari} hari lagi`;
}
const dua = (n: number) => String(n).padStart(2, "0");

export function AksesLaporanMitra({ periode: p }: { periode: PeriodeLaporan }) {
  const [kini, setKini] = useState<number | null>(null);
  const sudahRefresh = useRef(false);
  const router = useRouter();
  const bukaMs = p.buka_at ? Date.parse(p.buka_at) : null;
  const sisa = kini !== null && bukaMs !== null ? bukaMs - kini : null;
  const detikan = !p.terbuka && sisa !== null && sisa > 0 && sisa <= ENAM_JAM;

  useEffect(() => {
    setKini(Date.now());
    const t = setInterval(() => setKini(Date.now()), detikan ? 1000 : 60_000);
    return () => clearInterval(t);
  }, [detikan]);
  useEffect(() => {
    if (kini && bukaMs !== null && bukaMs <= kini && p.disetujui && !p.terbuka && !sudahRefresh.current) {
      sudahRefresh.current = true;
      router.refresh();
    }
  }, [kini, bukaMs, p.disetujui, p.terbuka, router]);

  const status = p.terbuka ? "terbuka" : statusKunci(p.buka_at, p.disetujui, kini ?? 0);
  const tgl = p.buka_at ? tanggalBuka(p.buka_at) : null;
  const j = sisa !== null ? Math.max(0, Math.floor(sisa / 1000)) : 0;
  const potong = [
    [Math.floor(j / 3600), "Jam"],
    [Math.floor((j % 3600) / 60), "Menit"],
    [j % 60, "Detik"],
  ] as const;
  const progres = detikan && sisa !== null ? Math.min(100, Math.max(0, (1 - sisa / ENAM_JAM) * 100)) : 0;

  return (
    <section className={`overflow-hidden rounded-3xl border bg-white ${p.terbuka ? "border-emerald-200" : "border-matur-200"}`}>
      <div className="flex flex-wrap items-center gap-4 p-4">
        <Image
          key={p.terbuka ? "buka" : "kunci"}
          src={p.terbuka ? "/mascot/laporan-terbuka.webp" : "/mascot/laporan-terkunci.webp"}
          width={88}
          height={88}
          alt={p.terbuka ? "Matoer memegang gembok terbuka" : "Matoer memegang gembok tertutup"}
          className={`size-20 shrink-0 ${p.terbuka ? "motion-safe:[animation:laporan-buka_.6s_ease-out]" : ""}`}
        />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">Laporan keuangan</p>
          <h2 className="text-lg font-extrabold text-kopi-900">{namaBulan(p.periode)}</h2>
          <span
            className={`mt-1 inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ${
              p.terbuka ? "bg-emerald-100 text-emerald-800" : status === "pemeriksaan" ? "bg-sky-100 text-sky-800" : "bg-matur-100 text-matur-800"
            }`}
          >
            {p.terbuka ? "🔓 Sudah tersedia" : status === "pemeriksaan" ? "🔎 Pemeriksaan akhir" : status === "belum_dijadwalkan" ? "🛠 Sedang disiapkan" : "🔒 Terkunci"}
          </span>
        </div>
        {p.terbuka && p.laporan_id && (
          <Link href={`/laporan/${p.laporan_id}`} className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-center text-sm font-bold text-white shadow-sm hover:bg-emerald-700 sm:w-auto">
            Lihat Laporan →
          </Link>
        )}
      </div>

      {!p.terbuka && (
        <div className="border-t border-matur-100 bg-matur-50/50 px-4 py-3">
          {status === "belum_dijadwalkan" && <p className="text-sm text-stone-600">Laporan sedang disiapkan tim Accounting. Jadwal pembukaan akan muncul di sini.</p>}
          {status === "pemeriksaan" && <p className="text-sm text-sky-900">Waktu buka sudah tiba. Laporan sedang dalam pemeriksaan akhir oleh Accounting dan segera tersedia.</p>}
          {status === "menunggu" && tgl && kini !== null && (
            <>
              <p className="text-xs text-stone-500">Dibuka pada</p>
              <p className="text-base font-bold text-kopi-900">
                {tgl.hari}, {tgl.tanggal} <span className="text-matur-700">· {tgl.jam} WIB</span>
              </p>
              {detikan ? (
                <div className="mt-3 space-y-2">
                  <div className="grid grid-cols-3 gap-2" aria-live="off" role="timer">
                    {potong.map(([n, l]) => (
                      <div key={l} className="rounded-2xl bg-kopi-900 py-2.5 text-center text-white shadow-inner">
                        <p className="text-3xl font-black tabular-nums tracking-tight">{dua(n)}</p>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/60">{l}</p>
                      </div>
                    ))}
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-matur-100" aria-hidden>
                    <div className="h-full rounded-full bg-gradient-to-r from-matur-400 to-matur-600 transition-[width] duration-1000 ease-linear" style={{ width: `${progres}%` }} />
                  </div>
                  <p className="text-[11px] text-stone-500">Halaman ini otomatis menampilkan laporan begitu waktunya tiba.</p>
                </div>
              ) : (
                bukaMs !== null && <p className="mt-1 text-sm font-semibold text-matur-700">⏳ {kapan(bukaMs, kini)}</p>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
