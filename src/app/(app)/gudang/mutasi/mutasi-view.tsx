"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { catatWaste, transferStok } from "@/lib/gudang-actions";

type Bahan = { id: string; nama: string; satuan_pakai: string; satuan_beli: string; konversi: number };
const nf = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });
const angka = (v: string) => Number(v.replace(",", ".")) || 0;

export function MutasiView({
  lokasi,
  outlets,
  asalTransfer,
  bahan,
  stok,
  riwayat,
}: {
  lokasi: { id: string; nama: string }[];
  outlets: { id: string; nama: string }[];
  asalTransfer: { id: string; nama: string }[];
  bahan: Bahan[];
  stok: { outlet_id: string | null; bahan_id: string; jumlah: number }[];
  riwayat: { id: string; outlet_id: string | null; bahan_id: string; jumlah: number; jenis: string; keterangan: string | null; created_at: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ error?: string; ok?: string } | null>(null);
  const [tab, setTab] = useState<"waste" | "transfer">("waste");
  const bmap = new Map(bahan.map((b) => [b.id, b]));
  const nama = (id: string | null) => (id ? outlets.find((o) => o.id === id)?.nama ?? "?" : "Gudang pusat");
  const sisa = (loc: string | null, b: string) => stok.find((x) => (x.outlet_id ?? "") === (loc ?? "") && x.bahan_id === b)?.jumlah ?? 0;
  const jalankan = (fn: () => Promise<{ error?: string; ok?: string }>, reset: () => void) =>
    start(async () => {
      const r = await fn();
      setMsg(r);
      if (!r.error) {
        reset();
        router.refresh();
      }
    });

  // waste
  const [wLok, setWLok] = useState(lokasi[0]?.id ?? "");
  const [wBahan, setWBahan] = useState("");
  const [wJml, setWJml] = useState("");
  const [wAlasan, setWAlasan] = useState("");
  // transfer
  const [dari, setDari] = useState(asalTransfer[0]?.id ?? "");
  const [ke, setKe] = useState(outlets.find((o) => o.id !== asalTransfer[0]?.id)?.id ?? "");
  const [items, setItems] = useState<{ bahan_id: string; jumlah: string }[]>([]);
  const [tCat, setTCat] = useState("");
  const [cari, setCari] = useState("");
  const saran = cari ? bahan.filter((b) => b.nama.toLowerCase().includes(cari.toLowerCase()) && !items.some((i) => i.bahan_id === b.id)).slice(0, 8) : [];

  const pilihBahan = (v: string, on: (id: string) => void) => (
    <select value={v} onChange={(e) => on(e.target.value)} className="w-full rounded-lg border border-stone-300 px-2 py-2 text-sm">
      <option value="">— pilih bahan —</option>
      {bahan.map((b) => (
        <option key={b.id} value={b.id}>
          {b.nama}
        </option>
      ))}
    </select>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Waste & Transfer Stok</h1>
        <p className="text-sm text-stone-500">Catat bahan rusak/terbuang, atau pindahkan stok dari satu outlet ke outlet lain. Semua tercatat di riwayat mutasi stok.</p>
      </div>
      <nav className="flex gap-1 rounded-xl bg-matur-50 p-1 text-sm font-semibold">
        {(
          [
            ["waste", "🗑 Waste / rusak"],
            ["transfer", "🔁 Transfer antar outlet"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex-1 rounded-lg px-3 py-2 ${tab === k ? "bg-white shadow-sm" : "text-stone-500"}`}>
            {l}
          </button>
        ))}
      </nav>
      {msg && <p className={`rounded-lg px-3 py-2 text-sm ${msg.error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>{msg.error ?? msg.ok}</p>}

      {tab === "waste" ? (
        <section className="grid gap-2 rounded-2xl border border-matur-200 bg-white p-4 sm:grid-cols-2">
          <label className="text-xs text-stone-600">
            Lokasi
            <select value={wLok} onChange={(e) => setWLok(e.target.value)} className="mt-0.5 w-full rounded-lg border border-stone-300 px-2 py-2 text-sm">
              {lokasi.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nama}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-stone-600">
            Bahan
            {pilihBahan(wBahan, setWBahan)}
          </label>
          <label className="text-xs text-stone-600">
            Jumlah terbuang {wBahan && `(${bmap.get(wBahan)?.satuan_pakai}) · stok ${nf.format(sisa(wLok || null, wBahan))}`}
            <input value={wJml} onChange={(e) => setWJml(e.target.value)} inputMode="decimal" className="mt-0.5 w-full rounded-lg border border-stone-300 px-2 py-2 text-sm" />
          </label>
          <label className="text-xs text-stone-600">
            Alasan
            <input value={wAlasan} onChange={(e) => setWAlasan(e.target.value)} placeholder="mis. susu basi, gelas pecah, kedaluwarsa" className="mt-0.5 w-full rounded-lg border border-stone-300 px-2 py-2 text-sm" />
          </label>
          <button
            disabled={pending || !wBahan || angka(wJml) <= 0 || !wAlasan.trim()}
            onClick={() => jalankan(() => catatWaste(wLok || null, wBahan, angka(wJml), wAlasan), () => (setWJml(""), setWAlasan("")))}
            className="rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2"
          >
            Catat waste
          </button>
        </section>
      ) : (
        <section className="space-y-2 rounded-2xl border border-matur-200 bg-white p-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs text-stone-600">
              Dari outlet
              <select value={dari} onChange={(e) => setDari(e.target.value)} className="mt-0.5 w-full rounded-lg border border-stone-300 px-2 py-2 text-sm">
                {asalTransfer.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nama}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-stone-600">
              Ke outlet
              <select value={ke} onChange={(e) => setKe(e.target.value)} className="mt-0.5 w-full rounded-lg border border-stone-300 px-2 py-2 text-sm">
                {outlets
                  .filter((o) => o.id !== dari)
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nama}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <div className="relative">
            <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="🔍 Tambah bahan…" className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
            {saran.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border bg-white shadow">
                {saran.map((b) => (
                  <li key={b.id}>
                    <button onClick={() => (setItems([...items, { bahan_id: b.id, jumlah: "" }]), setCari(""))} className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-matur-50">
                      <span>{b.nama}</span>
                      <span className="text-xs text-stone-500">
                        stok asal {nf.format(sisa(dari, b.id))} {b.satuan_pakai}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <ul className="divide-y">
            {items.map((it, i) => {
              const b = bmap.get(it.bahan_id)!;
              return (
                <li key={it.bahan_id} className="flex items-center gap-2 py-2 text-sm">
                  <span className="flex-1">{b.nama}</span>
                  <span className="text-xs text-stone-500">stok {nf.format(sisa(dari, b.id))}</span>
                  <input value={it.jumlah} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, jumlah: e.target.value } : x)))} inputMode="decimal" className="w-20 rounded-lg border px-2 py-1 text-right" />
                  <span className="w-12 text-xs">{b.satuan_pakai}</span>
                  <button onClick={() => setItems(items.filter((_, j) => j !== i))} className="px-1 text-red-600">
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
          <input value={tCat} onChange={(e) => setTCat(e.target.value)} placeholder="Catatan (opsional), mis. stok UHB habis untuk event" className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
          <button
            disabled={pending || !dari || !ke || !items.length || items.some((i) => angka(i.jumlah) <= 0)}
            onClick={() =>
              confirm(`Pindahkan ${items.length} bahan dari ${nama(dari)} ke ${nama(ke)}?`) &&
              jalankan(
                () => transferStok(dari, ke, items.map((i) => ({ bahan_id: i.bahan_id, nama: bmap.get(i.bahan_id)!.nama, satuan: bmap.get(i.bahan_id)!.satuan_pakai, jumlah: angka(i.jumlah) })), tCat),
                () => (setItems([]), setTCat("")),
              )
            }
            className="w-full rounded-xl bg-kopi-900 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            🔁 Transfer stok
          </button>
        </section>
      )}

      <section className="rounded-2xl border border-matur-200 bg-white p-4">
        <h2 className="mb-2 font-bold">Riwayat waste & transfer</h2>
        <ul className="divide-y text-sm">
          {riwayat.length === 0 && <li className="py-4 text-center text-stone-400">Belum ada.</li>}
          {riwayat.map((r) => (
            <li key={r.id} className="flex flex-wrap justify-between gap-2 py-1.5">
              <span>
                {new Date(r.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })} · {nama(r.outlet_id)} · <b>{bmap.get(r.bahan_id)?.nama ?? "?"}</b>
                <span className="text-xs text-stone-500"> · {r.keterangan}</span>
              </span>
              <span className={`tabular-nums ${Number(r.jumlah) < 0 ? "text-red-600" : "text-green-700"}`}>
                {Number(r.jumlah) > 0 ? "+" : ""}
                {nf.format(Number(r.jumlah))} {bmap.get(r.bahan_id)?.satuan_pakai}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
