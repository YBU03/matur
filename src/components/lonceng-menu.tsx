"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { tandaiNotifDibaca } from "@/lib/lonceng-actions";

export type ItemLonceng = {
  id: string;
  ikon: string;
  nada: "merah" | "kuning" | "netral";
  judul: string;
  isi: string;
  tautan: string | null;
  baru?: boolean;
  waktu?: string;
};

const WARNA = { merah: "bg-red-50 text-red-900", kuning: "bg-amber-50 text-amber-900", netral: "bg-white text-kopi-900" };

function kapan(iso: string) {
  const m = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} mnt lalu`;
  if (m < 1440) return `${Math.floor(m / 60)} jam lalu`;
  return new Date(iso).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short" });
}

/** Tombol lonceng + panel dropdown: peringatan penting di atas, notifikasi terbaru di bawah. */
export function LoncengMenu({ penting, terbaru }: { penting: ItemLonceng[]; terbaru: ItemLonceng[] }) {
  const router = useRouter();
  const [buka, setBuka] = useState(false);
  const wadah = useRef<HTMLDivElement>(null);
  const belumDibaca = terbaru.filter((n) => n.baru).length;
  const jumlah = penting.length + belumDibaca;

  useEffect(() => {
    if (!buka) return;
    const luar = (e: MouseEvent) => !wadah.current?.contains(e.target as Node) && setBuka(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setBuka(false);
    document.addEventListener("mousedown", luar);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", luar);
      document.removeEventListener("keydown", esc);
    };
  }, [buka]);

  const item = (n: ItemLonceng) => {
    const isi = (
      <>
        <span className="text-lg leading-none">{n.ikon}</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-2">
            <span className={`text-sm ${n.baru || n.nada !== "netral" ? "font-bold" : "font-semibold"}`}>{n.judul}</span>
            {n.baru && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-matur-500" aria-label="Belum dibaca" />}
          </span>
          {n.isi && <span className="mt-0.5 block text-xs opacity-80">{n.isi}</span>}
          {n.waktu && <span className="mt-0.5 block text-[11px] text-stone-400">{kapan(n.waktu)}</span>}
        </span>
      </>
    );
    const kelas = `flex gap-3 rounded-xl px-3 py-2.5 ${WARNA[n.nada]} ${n.tautan ? "hover:brightness-95" : ""}`;
    return n.tautan ? (
      <Link key={n.id} href={n.tautan} onClick={() => setBuka(false)} className={kelas}>
        {isi}
      </Link>
    ) : (
      <div key={n.id} className={kelas}>
        {isi}
      </div>
    );
  };

  return (
    <div ref={wadah} className="relative">
      <button
        onClick={() => {
          const b = !buka;
          setBuka(b);
          if (b && belumDibaca) tandaiNotifDibaca().then(() => router.refresh()).catch(() => {});
        }}
        aria-label={jumlah ? `Notifikasi, ${jumlah} perlu perhatian` : "Notifikasi"}
        aria-expanded={buka}
        className="relative grid size-10 place-items-center rounded-xl text-kopi-900 hover:bg-matur-50"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {jumlah > 0 && (
          <span className={`absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-bold text-white ring-2 ring-white ${penting.some((p) => p.nada === "merah") ? "bg-red-600" : "bg-matur-500"}`}>
            {jumlah > 9 ? "9+" : jumlah}
          </span>
        )}
      </button>
      {buka && (
        <div className="fixed inset-x-3 top-14 z-50 max-h-[75vh] overflow-y-auto rounded-2xl border border-matur-100 bg-white p-3 shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-96">
          <p className="px-1 pb-2 text-sm font-bold text-kopi-900">Notifikasi</p>
          {penting.length > 0 && (
            <div className="space-y-1.5">
              <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-stone-400">Perlu ditindak</p>
              {penting.map(item)}
            </div>
          )}
          <div className={`space-y-1 ${penting.length ? "mt-3" : ""}`}>
            {penting.length > 0 && <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-stone-400">Terbaru</p>}
            {terbaru.length ? terbaru.map(item) : <p className="px-1 py-4 text-center text-sm text-stone-400">{penting.length ? "Tidak ada notifikasi lain." : "Semua aman, tidak ada notifikasi. ✨"}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
