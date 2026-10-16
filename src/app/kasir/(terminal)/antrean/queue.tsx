"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
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

const NEXT = {
  baru: ["diproses", "▶ Mulai buat"],
  diproses: ["siap", "✓ Siap diambil"],
  siap: ["diambil", "🙌 Sudah diambil"],
} as const;

const KOLOM = [
  {
    status: "baru",
    judul: "Pesanan Baru",
    ikon: "🔔",
    kepala: "from-red-500 to-rose-500",
    tombol: "bg-red-500 hover:bg-red-600",
    garis: "border-red-200",
  },
  {
    status: "diproses",
    judul: "Sedang Dibuat",
    ikon: "☕",
    kepala: "from-matur-500 to-orange-500",
    tombol: "bg-matur-500 hover:bg-matur-600",
    garis: "border-matur-200",
  },
  {
    status: "siap",
    judul: "Siap Diambil",
    ikon: "✅",
    kepala: "from-emerald-500 to-green-600",
    tombol: "bg-emerald-600 hover:bg-emerald-700",
    garis: "border-emerald-200",
  },
] as const;

const KANAL: Record<string, { label: string; warna: string }> = {
  langsung: { label: "Langsung", warna: "bg-kopi-900 text-white" },
  gofood: { label: "GoFood", warna: "bg-green-600 text-white" },
  grabfood: { label: "GrabFood", warna: "bg-emerald-500 text-white" },
  shopeefood: { label: "ShopeeFood", warna: "bg-orange-500 text-white" },
};

/** bunyi "ting" singkat saat ada pesanan baru (tanpa file audio) */
function ting() {
  try {
    const ctx = new AudioContext();
    for (const [i, f] of [880, 1320].entries()) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.15);
      g.gain.exponentialRampToValueAtTime(
        0.3,
        ctx.currentTime + i * 0.15 + 0.02,
      );
      g.gain.exponentialRampToValueAtTime(
        0.0001,
        ctx.currentTime + i * 0.15 + 0.35,
      );
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.15);
      o.stop(ctx.currentTime + i * 0.15 + 0.4);
    }
  } catch {}
}

export function Queue({ orders }: { orders: Order[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [suara, setSuara] = useState(true);
  const [jam, setJam] = useState("");
  const dikenal = useRef<Set<string> | null>(null);

  // segarkan otomatis tiap 5 detik, jam & lama tunggu tiap 15 detik
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 5000);
    const j = () => {
      setNow(Date.now());
      setJam(
        new Date().toLocaleTimeString("id-ID", {
          timeZone: "Asia/Jakarta",
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    };
    j();
    const u = setInterval(j, 15000);
    try {
      setSuara(localStorage.getItem("matoer_antrean_suara") !== "0");
    } catch {}
    return () => {
      clearInterval(t);
      clearInterval(u);
    };
  }, [router]);

  // bunyi bila ada pesanan baru yang belum pernah tampil
  useEffect(() => {
    const ids = new Set(
      orders.filter((o) => o.status_pesanan === "baru").map((o) => o.id),
    );
    if (
      dikenal.current &&
      suara &&
      [...ids].some((id) => !dikenal.current!.has(id))
    )
      ting();
    dikenal.current = new Set([...(dikenal.current ?? []), ...ids]);
  }, [orders, suara]);

  const menit = (iso: string) =>
    Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
  const warnaTunggu = (m: number) =>
    m >= 10
      ? "bg-red-100 text-red-700"
      : m >= 5
        ? "bg-amber-100 text-amber-800"
        : "bg-emerald-100 text-emerald-800";

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center gap-3 rounded-3xl bg-gradient-to-r from-kopi-900 to-kopi-700 p-4 text-white shadow-md">
        <Image
          src="/mascot/kasir-pos.webp"
          alt=""
          width={56}
          height={56}
          className="size-14 drop-shadow"
        />
        <div className="mr-auto">
          <h1 className="text-2xl font-extrabold">Antrean Pesanan</h1>
          <p className="text-xs text-white/75">
            Diperbarui otomatis · ketuk tombol untuk memindahkan pesanan
          </p>
        </div>
        <div className="flex gap-2">
          {KOLOM.map((k) => (
            <span
              key={k.status}
              className={`rounded-2xl bg-gradient-to-br px-3 py-1.5 text-center ${k.kepala}`}
            >
              <span className="block text-xl font-extrabold tabular-nums leading-none">
                {orders.filter((o) => o.status_pesanan === k.status).length}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wide">
                {k.status}
              </span>
            </span>
          ))}
        </div>
        <span className="text-3xl font-extrabold tabular-nums">{jam}</span>
        <div className="flex gap-1">
          <button
            onClick={() => {
              const v = !suara;
              setSuara(v);
              try {
                localStorage.setItem("matoer_antrean_suara", v ? "1" : "0");
              } catch {}
              if (v) ting();
            }}
            className="rounded-xl bg-white/15 px-3 py-2 text-sm font-semibold hover:bg-white/25"
            title="Bunyi saat ada pesanan baru"
          >
            {suara ? "🔔 Suara on" : "🔕 Suara off"}
          </button>
          <button
            onClick={() =>
              (document.fullscreenElement
                ? document.exitFullscreen()
                : document.documentElement.requestFullscreen()
              ).catch(() => {})
            }
            className="rounded-xl bg-white/15 px-3 py-2 text-sm font-semibold hover:bg-white/25"
            title="Layar penuh"
          >
            ⛶
          </button>
        </div>
      </header>

      {err && (
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {err}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {KOLOM.map((k) => {
          const list = orders.filter((o) => o.status_pesanan === k.status);
          return (
            <section
              key={k.status}
              className="flex min-h-[50vh] flex-col overflow-hidden rounded-3xl bg-white/70 shadow-sm ring-1 ring-stone-200"
            >
              <h2
                className={`flex items-center gap-2 bg-gradient-to-r px-4 py-3 text-lg font-extrabold text-white ${k.kepala}`}
              >
                <span>{k.ikon}</span>
                <span className="mr-auto">{k.judul}</span>
                <span className="rounded-full bg-white/25 px-2.5 text-base tabular-nums">
                  {list.length}
                </span>
              </h2>
              <div className="flex-1 space-y-3 p-3">
                {!list.length && (
                  <div className="flex h-full min-h-40 flex-col items-center justify-center gap-1 text-center text-sm text-stone-400">
                    <span className="text-4xl opacity-60">{k.ikon}</span>
                    {k.status === "baru"
                      ? "Belum ada pesanan baru. Santai dulu ☕"
                      : k.status === "diproses"
                        ? "Tidak ada yang sedang dibuat."
                        : "Belum ada pesanan siap."}
                  </div>
                )}
                {list.map((o) => {
                  const m = menit(o.created_at);
                  const kanal = KANAL[o.kanal] ?? {
                    label: o.kanal,
                    warna: "bg-stone-700 text-white",
                  };
                  const jumlah = o.item_transaksi.reduce(
                    (t, i) => t + i.qty,
                    0,
                  );
                  return (
                    <article
                      key={o.id}
                      className={`pos-muncul rounded-2xl border-2 bg-white p-4 shadow-sm ${k.garis} ${k.status === "baru" ? "pos-baru" : ""}`}
                    >
                      <div className="flex items-start gap-2">
                        <p className="text-4xl font-black leading-none tracking-tight text-kopi-900">
                          #{o.nomor}
                        </p>
                        <div className="ml-auto flex flex-col items-end gap-1">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums ${warnaTunggu(m)}`}
                          >
                            ⏱ {m} mnt
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${kanal.warna}`}
                          >
                            {kanal.label}
                          </span>
                        </div>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-stone-600">
                        {o.tipe === "dine_in" ? "🍽 Dine-in" : "🥡 Take away"}
                        {o.meja ? ` · Meja ${o.meja}` : ""}
                        {o.pelanggan ? ` · ${o.pelanggan}` : ""}
                      </p>
                      <ul className="my-3 space-y-1.5 border-y border-dashed border-stone-200 py-3">
                        {o.item_transaksi.map((it, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-matur-100 text-sm font-extrabold text-matur-800">
                              {it.qty}
                            </span>
                            <span className="min-w-0 pt-0.5 text-base font-semibold leading-snug text-kopi-900">
                              {it.nama}
                              {it.catatan && (
                                <span className="mt-0.5 block rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                                  📝 {it.catatan}
                                </span>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-stone-500">
                          {jumlah} item
                        </span>
                        <button
                          disabled={pending}
                          onClick={() =>
                            start(async () => {
                              setErr(
                                (
                                  await ubahStatus(
                                    o.id,
                                    NEXT[o.status_pesanan][0],
                                  )
                                ).error ?? "",
                              );
                              router.refresh();
                            })
                          }
                          className={`ml-auto rounded-xl px-4 py-3 text-base font-extrabold text-white shadow-sm transition active:scale-95 disabled:opacity-60 ${k.tombol}`}
                        >
                          {NEXT[o.status_pesanan][1]}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
