"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { aturRumusHpp } from "@/lib/harian-actions";

type Kat = { id: string; nama: string; grup: string; urutan: number };
const GRUP: [string, string, string][] = [
  ["hpp", "Pembelian bahan baku (masuk HPP)", "bg-amber-100 text-amber-800"],
  ["beban", "Beban operasional", "bg-sky-100 text-sky-800"],
  ["lain", "Lain-lain / di luar laba rugi", "bg-stone-100 text-stone-700"],
];

export function RumusView({ rumus, kategori }: { rumus: { kiriman_gudang: boolean; titipan: boolean }; kategori: Kat[] }) {
  const [r, setR] = useState(rumus);
  const [grup, setGrup] = useState<Record<string, string>>(() => Object.fromEntries(kategori.map((k) => [k.id, k.grup])));
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  const berubah = Object.fromEntries(Object.entries(grup).filter(([id, g]) => kategori.find((k) => k.id === id)?.grup !== g));
  const hppKat = kategori.filter((k) => grup[k.id] === "hpp").map((k) => k.nama);

  const simpan = () =>
    start(async () => {
      setMsg(await aturRumusHpp(r, berubah));
    });

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Rumus HPP</h1>
        <p className="text-sm text-stone-500">Atur komponen Harga Pokok Penjualan. Berlaku untuk halaman Persediaan & HPP, proyeksi laporan, dan tutup buku bulan yang belum terbit.</p>
      </div>

      <section className="rounded-2xl border border-matur-200 bg-gradient-to-br from-amber-50 to-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Rumus aktif</p>
        <p className="mt-1 text-lg font-bold leading-relaxed">
          HPP = Persediaan awal + <span className="text-amber-700">Pembelian bahan baku</span>
          {r.titipan && <> + <span className="text-pink-700">Tagihan dessert & cheesecake</span></>} − Persediaan akhir
        </p>
        <p className="mt-2 text-sm text-stone-600">
          Pembelian bahan baku = {[r.kiriman_gudang && "kiriman gudang yang diterima", ...hppKat].filter(Boolean).join(" + ") || <i>(kosong)</i>}
        </p>
      </section>

      <section className="space-y-2 rounded-2xl border border-stone-200 bg-white p-4">
        <h2 className="font-bold">Komponen</h2>
        {(
          [
            ["kiriman_gudang", "Kiriman bahan dari gudang pusat", "Nilai kiriman yang sudah diterima outlet dihitung sebagai pembelian bahan baku."],
            ["titipan", "Tagihan dessert & cheesecake (titipan)", "Hanya yang terjual/keluar × harga produsen (Bu Ratna) yang dibebankan."],
          ] as const
        ).map(([k, judul, ket]) => (
          <label key={k} className="flex cursor-pointer items-start gap-3 rounded-xl border border-stone-200 p-3 hover:bg-stone-50">
            <input type="checkbox" className="mt-1 size-4 accent-matur-600" checked={r[k]} onChange={(e) => setR({ ...r, [k]: e.target.checked })} />
            <span>
              <span className="font-semibold">{judul}</span>
              <span className="block text-xs text-stone-500">{ket}</span>
            </span>
          </label>
        ))}
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-4">
        <h2 className="font-bold">Kategori biaya</h2>
        <p className="mb-2 text-xs text-stone-500">Kategori bertanda “Pembelian bahan baku” dari catatan harian/biaya operasional ikut menambah HPP.</p>
        <div className="divide-y">
          {kategori.map((k) => (
            <div key={k.id} className="flex flex-wrap items-center gap-2 py-2">
              <span className="mr-auto text-sm">{k.nama}</span>
              <div className="flex gap-1">
                {GRUP.map(([g, label, warna]) => (
                  <button
                    key={g}
                    type="button"
                    title={label}
                    onClick={() => setGrup({ ...grup, [k.id]: g })}
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${grup[k.id] === g ? warna + " ring-2 ring-offset-1 ring-stone-300" : "bg-white text-stone-400 border border-stone-200"}`}
                  >
                    {g === "hpp" ? "HPP" : g === "beban" ? "Beban" : "Lain"}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {msg.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{msg.error}</p>}
      {msg.ok && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{msg.ok}</p>}
      <div className="flex flex-wrap gap-2">
        <button onClick={simpan} disabled={pending} className="rounded-xl bg-kopi-900 px-4 py-2 font-semibold text-white disabled:opacity-50">
          {pending ? "Menyimpan…" : "Simpan rumus"}
        </button>
        <Link href="/persediaan" className="rounded-xl border border-matur-300 px-4 py-2 font-semibold text-matur-700">Lihat Persediaan & HPP</Link>
      </div>
      <p className="text-xs text-stone-500">Laporan yang sudah terbit tidak berubah — angkanya terkunci di laporan.</p>
    </div>
  );
}
