"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export type OmzetHariIni = {
  hari: string;
  sekarang: string;
  omzet: number;
  trx: number;
  terakhir: string | null;
  kemarin_omzet: number;
  kemarin_trx: number;
  outlet: { outlet_id: string; nama: string; omzet: number; trx: number }[];
  jam: { jam: number; trx: number }[];
};

const KUNCI = "matoer_sembunyi_omzet";
const nf = new Intl.NumberFormat("id-ID");
const rp = (n: number) => `Rp ${nf.format(Math.round(n))}`;
const singkat = (n: number) => (n >= 1e6 ? `Rp ${(n / 1e6).toFixed(1).replace(".", ",")} jt` : n >= 1e3 ? `Rp ${Math.round(n / 1e3)} rb` : rp(n));
const jamWib = (iso: string) => new Date(iso).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" });

function lalu(iso: string, now: number) {
  const m = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
  if (m < 1) return "barusan";
  if (m < 60) return `${m} mnt lalu`;
  return `${Math.floor(m / 60)} jam lalu`;
}

function Mata({ tutup }: { tutup: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {tutup && <path d="M3 3l18 18" />}
    </svg>
  );
}

/** Kartu gaya aplikasi bank: omzet hari ini sampai detik ini, dibanding kemarin di jam yang sama. */
export function KartuOmzet({ d, label, tautan }: { d: OmzetHariIni; label: string; tautan?: { href: string; teks: string } }) {
  const [sembunyi, setSembunyi] = useState(false);
  const [now, setNow] = useState(() => new Date(d.sekarang).getTime());
  useEffect(() => {
    try {
      setSembunyi(localStorage.getItem(KUNCI) === "1");
    } catch {}
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, [d.sekarang]);
  const ubah = () => {
    const v = !sembunyi;
    setSembunyi(v);
    try {
      localStorage.setItem(KUNCI, v ? "1" : "0");
    } catch {}
  };

  const omzet = Number(d.omzet);
  const kemarin = Number(d.kemarin_omzet);
  const persen = kemarin ? Math.round(((omzet - kemarin) / kemarin) * 100) : null;
  const jamRamai = [...d.jam].sort((a, b) => b.trx - a.trx)[0];
  const tutup = (s: string) => (sembunyi ? "•••••" : s);

  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-kopi-900 via-kopi-800 to-matur-700 p-5 text-white shadow-lg sm:p-6">
      <span className="pointer-events-none absolute -right-12 -top-16 size-48 rounded-full bg-white/10" aria-hidden />
      <span className="pointer-events-none absolute -bottom-20 right-16 size-40 rounded-full bg-matur-400/20" aria-hidden />
      <div className="relative grid gap-5 lg:grid-cols-[1.3fr_1fr] lg:items-center">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-widest text-white/75">Omzet hari ini</p>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/20 px-2 py-0.5 text-[11px] font-bold text-emerald-200">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-300 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-300" />
              </span>
              Live
            </span>
            <button onClick={ubah} aria-label={sembunyi ? "Tampilkan nominal" : "Sembunyikan nominal"} aria-pressed={sembunyi} className="ml-auto grid size-9 place-items-center rounded-xl bg-white/10 text-white/90 hover:bg-white/20">
              <Mata tutup={sembunyi} />
            </button>
          </div>
          <p className="mt-1 text-xs text-white/60">{label}</p>
          <p className="mt-2 text-4xl font-black tracking-tight tabular-nums sm:text-5xl">{sembunyi ? "Rp •••••••" : rp(omzet)}</p>
          <p className="mt-2 text-sm">
            {persen === null ? (
              <span className="text-white/75">{omzet ? "Kemarin di jam ini belum ada penjualan" : "Belum ada penjualan hari ini"}</span>
            ) : (
              <>
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${persen >= 0 ? "bg-emerald-400/20 text-emerald-200" : "bg-red-400/25 text-red-100"}`}>
                  {persen >= 0 ? "▲" : "▼"} {Math.abs(persen)}%
                </span>{" "}
                <span className="text-white/75">vs kemarin di jam yang sama{!sembunyi && ` (${singkat(kemarin)})`}</span>
              </>
            )}
          </p>
          <p className="mt-2 text-xs text-white/60">
            Update {jamWib(d.sekarang)} WIB{d.terakhir && ` · transaksi terakhir ${lalu(d.terakhir, now)}`}
          </p>
        </div>

        <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-[11px] text-white/65">Struk</p>
              <p className="text-lg font-extrabold tabular-nums">{nf.format(d.trx)}</p>
            </div>
            <div>
              <p className="text-[11px] text-white/65">Per struk</p>
              <p className="text-lg font-extrabold tabular-nums">{d.trx ? tutup(nf.format(Math.round(omzet / d.trx))) : "-"}</p>
            </div>
            <div>
              <p className="text-[11px] text-white/65">Jam ramai</p>
              <p className="text-lg font-extrabold tabular-nums">{jamRamai ? `${String(jamRamai.jam).padStart(2, "0")}.00` : "-"}</p>
            </div>
          </div>
          {d.outlet.length > 1 && (
            <ul className="mt-3 space-y-1.5 border-t border-white/15 pt-3 text-sm">
              {d.outlet.map((o) => (
                <li key={o.outlet_id} className="flex items-center justify-between gap-2">
                  <span className="truncate text-white/80">{o.nama}</span>
                  <span className="shrink-0 font-bold tabular-nums">
                    {tutup(singkat(Number(o.omzet)))} <span className="text-xs font-normal text-white/60">· {o.trx} struk</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {tautan && (
            <Link href={tautan.href} className="mt-3 flex items-center justify-center gap-1 rounded-xl bg-white px-3 py-2 text-sm font-bold text-kopi-900 hover:bg-matur-50">
              {tautan.teks} ›
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
