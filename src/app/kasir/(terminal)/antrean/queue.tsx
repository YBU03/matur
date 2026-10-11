"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ubahStatus } from "@/lib/pos-actions";

export type Order = {
  id: string;
  nomor: number;
  kanal: string;
  tipe: string;
  pelanggan: string | null;
  meja: string | null;
  status_pesanan: "baru" | "diproses" | "siap";
  created_at: string;
  item_transaksi: { nama: string; qty: number; catatan: string | null }[];
};

const NEXT = { baru: ["diproses", "Proses"], diproses: ["siap", "Siap"], siap: ["diambil", "Sudah diambil"] } as const;
const COLS = [
  ["baru", "Baru", "border-red-300"],
  ["diproses", "Diproses", "border-matur-400"],
  ["siap", "Siap", "border-green-400"],
] as const;

export function Queue({ orders }: { orders: Order[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");

  // segarkan otomatis tiap 5 detik
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(t);
  }, [router]);

  const minutes = (iso: string) => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold">Antrean Pesanan</h1>
      {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
      <div className="grid gap-4 md:grid-cols-3">
        {COLS.map(([status, label, border]) => (
          <section key={status} className="space-y-3">
            <h2 className="font-semibold">
              {label} ({orders.filter((o) => o.status_pesanan === status).length})
            </h2>
            {orders
              .filter((o) => o.status_pesanan === status)
              .map((o) => (
                <article key={o.id} className={`rounded-2xl border-2 bg-white p-4 shadow-sm ${border}`}>
                  <div className="flex items-baseline justify-between">
                    <p className="text-2xl font-extrabold">#{o.nomor}</p>
                    <p className="text-xs text-stone-500">{minutes(o.created_at)} mnt lalu</p>
                  </div>
                  <p className="text-xs uppercase text-stone-500">
                    {o.kanal} · {o.tipe === "dine_in" ? "Dine-in" : "Take away"}
                    {o.meja ? ` · Meja ${o.meja}` : ""}
                    {o.pelanggan ? ` · ${o.pelanggan}` : ""}
                  </p>
                  <ul className="my-2 space-y-1">
                    {o.item_transaksi.map((it, i) => (
                      <li key={i} className="font-medium">
                        {it.qty}× {it.nama}
                        {it.catatan && <span className="block text-xs text-stone-500">{it.catatan}</span>}
                      </li>
                    ))}
                  </ul>
                  <button
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        setErr((await ubahStatus(o.id, NEXT[o.status_pesanan][0])).error ?? "");
                        router.refresh();
                      })
                    }
                    className="w-full rounded-xl bg-matur-500 py-2 font-semibold text-white disabled:opacity-60"
                  >
                    {NEXT[o.status_pesanan][1]}
                  </button>
                </article>
              ))}
          </section>
        ))}
      </div>
    </div>
  );
}
