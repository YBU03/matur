"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { namaBulan } from "@/lib/laporan";
import { statusKunci, type PeriodeLaporan } from "@/lib/laporan-internal";
export function AksesLaporanMitra({ periode: p }: { periode: PeriodeLaporan }) {
  const [kini, setKini] = useState<number | null>(null),
    [detail, setDetail] = useState(false);
  const sudahRefresh = useRef(false);
  const router = useRouter();
  useEffect(() => {
    setKini(Date.now());
    const t = setInterval(() => {
      setKini(Date.now());
      if (!p.terbuka && p.buka_at && Date.parse(p.buka_at) <= Date.now())
        router.refresh();
    }, 60000);
    return () => clearInterval(t);
  }, [p.terbuka, p.buka_at, router]);
  const status = statusKunci(p.buka_at, p.disetujui, kini ?? 0);
  useEffect(() => {
    if (
      kini &&
      p.buka_at &&
      Date.parse(p.buka_at) <= kini &&
      p.disetujui &&
      !p.terbuka &&
      !sudahRefresh.current
    ) {
      sudahRefresh.current = true;
      router.refresh();
    }
  }, [kini, p, router]);
  const menit =
    p.buka_at && kini
      ? Math.max(0, Math.ceil((Date.parse(p.buka_at) - kini) / 60000))
      : 0;
  const jadwal = p.buka_at
    ? new Date(p.buka_at).toLocaleString("id-ID", {
        timeZone: "Asia/Jakarta",
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }) + " WIB"
    : null;
  return (
    <section className="rounded-2xl border border-matur-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <Image
          src={
            p.terbuka
              ? "/mascot/laporan-terbuka.webp"
              : "/mascot/laporan-terkunci.webp"
          }
          width={88}
          height={88}
          alt={
            p.terbuka
              ? "Matoer memegang gembok terbuka"
              : "Matoer memegang gembok tertutup"
          }
          className="h-20 w-20 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <h2 className="font-bold">{namaBulan(p.periode)}</h2>
          <p
            className={`text-sm font-semibold ${p.terbuka ? "text-green-700" : "text-matur-700"}`}
          >
            {p.terbuka ? "Laporan sudah tersedia" : "Laporan masih terkunci"}
          </p>
          {p.terbuka && p.laporan_id ? (
            <Link
              className="mt-2 inline-block rounded-lg bg-matur-700 px-3 py-2 text-sm font-semibold text-white"
              href={`/laporan/${p.laporan_id}`}
            >
              Lihat Laporan →
            </Link>
          ) : (
            <button
              className="mt-2 text-left text-sm font-semibold text-matur-700 underline"
              onClick={() => setDetail(!detail)}
              aria-expanded={detail}
            >
              Lihat jadwal pembukaan {detail ? "▴" : "▾"}
            </button>
          )}
        </div>
      </div>
      {!p.terbuka && (
        <div className="mt-3 rounded-xl bg-matur-50 p-3 text-sm">
          <p>
            {jadwal
              ? `Dijadwalkan tersedia mulai ${jadwal}.`
              : "Laporan sedang disiapkan. Jadwal tersedia akan diinformasikan."}
          </p>
          {kini && status === "menunggu" && (
            <p className="mt-1 font-bold tabular-nums">
              Dibuka dalam {Math.floor(menit / 1440)} hari{" "}
              {Math.floor((menit % 1440) / 60)} jam {menit % 60} menit
            </p>
          )}
          {kini && status === "pemeriksaan" && (
            <p className="mt-1 font-semibold">
              Laporan dalam pemeriksaan akhir.
            </p>
          )}
          {detail && (
            <p className="mt-2 text-xs text-stone-600">
              Isi laporan dan unduhan tersedia setelah Accounting menyetujui
              laporan dan jadwal pembukaan tercapai.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
