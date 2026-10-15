"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { bacaSnapshot } from "@/lib/pos-offline";
import { PosRuntime, type PosSnapshot } from "@/components/pos-runtime";
import { PosAntrean } from "@/components/pos-antrean";
export default function OfflinePos() {
  const [snapshot, setSnapshot] = useState<PosSnapshot | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    bacaSnapshot<PosSnapshot>()
      .then(setSnapshot)
      .catch(() => setSnapshot(null))
      .finally(() => setLoaded(true));
  }, []);
  return (
    <main className="min-h-screen p-4">
      <PosAntrean />
      {snapshot ? (
        <PosRuntime initial={snapshot} offlineBoot />
      ) : (
        <div className="mx-auto max-w-md rounded-2xl border bg-white p-6 text-center">
          <h1 className="text-xl font-bold">POS belum tersedia offline</h1>
          <p className="mt-3 text-sm">
            {loaded
              ? "Buka dan verifikasi sesi tim di tablet saat online terlebih dahulu."
              : "Membaca penyimpanan tablet…"}
          </p>
          <Link className="mt-4 inline-block underline" href="/kasir/pos">
            Kembali ke POS saat online
          </Link>
        </div>
      )}
    </main>
  );
}
