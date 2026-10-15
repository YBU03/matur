"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { formatRupiah } from "@/lib/format";

export type TabletInfo = {
  outlet: string;
  tablet: string;
  shift: string | null;
  tim: string[];
  operator: { nama: string; kasir: boolean } | null;
  omzet: { total: number; jumlah: number } | null;
};

/** Header tablet POS: outlet, shift, tim, operator aktif, jam, omzet shift, status koneksi. */
export function TabletHeader({
  info,
  beranda = false,
  children,
}: {
  info: TabletInfo;
  beranda?: boolean;
  children?: React.ReactNode;
}) {
  const [jam, setJam] = useState("");
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const t = () =>
      setJam(
        new Date().toLocaleTimeString("id-ID", {
          timeZone: "Asia/Jakarta",
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    const o = () => setOnline(navigator.onLine);
    t();
    o();
    const i = setInterval(t, 15000);
    window.addEventListener("online", o);
    window.addEventListener("offline", o);
    return () => {
      clearInterval(i);
      window.removeEventListener("online", o);
      window.removeEventListener("offline", o);
    };
  }, []);
  return (
    <header className="sticky top-0 z-40 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-matur-200 bg-white px-4 py-2">
      <Link
        href="/pos"
        className="flex items-center gap-2"
        aria-label="Beranda tablet"
      >
        <Image
          src="/brand/logo-192.png"
          alt="Matoer"
          width={36}
          height={36}
          className="rounded-lg"
        />
        <div className="leading-tight">
          <p className="text-sm font-bold">{info.outlet}</p>
          <p className="text-xs text-stone-500">
            {info.shift ?? "Belum ada shift"} · {info.tablet}
          </p>
        </div>
      </Link>
      <div className="mr-auto min-w-0 text-xs leading-tight">
        {info.tim.length > 0 && (
          <p className="truncate text-stone-600">👥 {info.tim.join(", ")}</p>
        )}
        {info.operator && (
          <p>
            👤 Operator: <b>{info.operator.nama}</b>
            {!info.operator.kasir && (
              <span className="ml-1 rounded bg-amber-100 px-1 text-amber-800">
                tanpa akses bayar
              </span>
            )}
          </p>
        )}
      </div>
      {info.omzet && (
        <div className="text-right text-xs leading-tight">
          <p className="text-stone-500">Omzet shift</p>
          <p className="font-bold">
            {formatRupiah(info.omzet.total)} · {info.omzet.jumlah} trx
          </p>
        </div>
      )}
      <div className="text-right text-xs leading-tight">
        <p className="text-lg font-bold tabular-nums">{jam}</p>
        <p className={online ? "text-green-700" : "text-red-600"}>
          {online ? "● Online" : "● Offline"}
        </p>
      </div>
      {!beranda && (
        <Link
          href="/pos"
          className="rounded-xl border border-matur-300 px-3 py-2 text-sm font-semibold"
        >
          🏠 Beranda
        </Link>
      )}
      {children}
    </header>
  );
}
