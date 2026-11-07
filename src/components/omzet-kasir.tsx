"use client";

// Kartu kecil omzet hari ini di layar Kasir (hanya baca). Diperbarui saat dibuka, tiap menit, saat kembali ke layar, dan setelah transaksi.
import Link from "next/link";
import { useEffect, useState } from "react";
import { formatRupiah } from "@/lib/format";
import { omzetKasirHariIni } from "@/lib/omzet-kasir-actions";

export function OmzetKasir({ segarkan }: { segarkan?: unknown }) {
  const [d, setD] = useState<{ transaksi: number; omzet: number } | null>(null);
  useEffect(() => {
    let hidup = true;
    const muat = () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      omzetKasirHariIni()
        .then((x) => hidup && x && setD(x))
        .catch(() => {});
    };
    muat();
    const t = setInterval(muat, 60_000);
    const fokus = () => document.visibilityState === "visible" && muat();
    document.addEventListener("visibilitychange", fokus);
    return () => {
      hidup = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", fokus);
    };
  }, [segarkan]);
  return (
    <Link
      href="/kasir/riwayat"
      title="Lihat riwayat hari ini"
      className="flex shrink-0 items-center gap-2 rounded-lg bg-white px-2.5 py-1 ring-1 ring-matur-200 transition hover:ring-matur-400"
    >
      <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">Hari ini</span>
      <span className="text-xs font-semibold text-kopi-700 tabular-nums">{d ? `${d.transaksi} trx` : "…"}</span>
      <span className="text-sm font-extrabold text-matur-700 tabular-nums">{d ? formatRupiah(d.omzet) : ""}</span>
    </Link>
  );
}
