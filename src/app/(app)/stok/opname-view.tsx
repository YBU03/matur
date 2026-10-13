"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { simpanOpname } from "@/lib/opname-actions";

type Bahan = { id: string; nama: string; kategori: string | null; satuan_beli: string; satuan_pakai: string; konversi: number; hargaPakai: number; sistem: number };
const nf = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });
const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));

export function OpnameView({ outlets, outletId, bahan, riwayat }: { outlets: { id: string; nama: string }[]; outletId: string; bahan: Bahan[]; riwayat: { id: string; tanggal: string; total_nilai: number; catatan: string | null }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ error?: string; ok?: string } | null>(null);
  // isian dalam satuan pakai (gram/ml/pcs) agar sama dengan sheet "Stok Akhir" Ruma
  const [isi, setIsi] = useState<Record<string, string>>({});
  const [tanggal, setTanggal] = useState(new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10));
  const [catatan, setCatatan] = useState("");
  const [q, setQ] = useState("");
  const terisi = bahan.filter((b) => num(isi[b.id] ?? "") !== null);
  const nilai = terisi.reduce((s, b) => s + (num(isi[b.id]!) ?? 0) * b.hargaPakai, 0);
  const tampil = bahan.filter((b) => !q || b.nama.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Stok & Opname Outlet</h1>
        <p className="text-sm text-stone-500">Hitung stok fisik (biasanya akhir bulan). Nilainya menjadi persediaan akhir di laporan keuangan.</p>
      </div>
      {outlets.length > 1 && (
        <select value={outletId} onChange={(e) => router.push(`/stok?outlet=${e.target.value}`)} className="rounded-lg border px-3 py-2 text-sm">
          {outlets.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nama}
            </option>
          ))}
        </select>
      )}
      {msg && <p className={`rounded-lg px-3 py-2 text-sm ${msg.error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>{msg.error ?? msg.ok}</p>}

      <section className="rounded-2xl border border-matur-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 Cari bahan…" className="min-w-40 flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm" />
          <button onClick={() => setIsi(Object.fromEntries(bahan.map((b) => [b.id, String(Math.round(b.sistem * 100) / 100)])))} className="rounded-lg border border-matur-300 px-3 py-2 text-xs text-matur-700">
            Isi sesuai stok sistem
          </button>
        </div>
        <ul className="divide-y">
          {tampil.map((b) => {
            const v = num(isi[b.id] ?? "");
            const beda = v !== null && Math.abs(v - b.sistem) > 0.001;
            return (
              <li key={b.id} className="flex items-center gap-2 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{b.nama}</p>
                  <p className="text-xs text-stone-500">
                    sistem {nf.format(b.sistem)} {b.satuan_pakai}
                    {b.konversi !== 1 && ` (${nf.format(b.sistem / b.konversi)} ${b.satuan_beli})`}
                    {beda && <b className="ml-1 text-amber-700">→ {v! > b.sistem ? "+" : ""}{nf.format(v! - b.sistem)}</b>}
                  </p>
                </div>
                <input value={isi[b.id] ?? ""} onChange={(e) => setIsi({ ...isi, [b.id]: e.target.value })} inputMode="decimal" placeholder="fisik" className="w-24 rounded-lg border border-stone-300 px-2 py-1.5 text-right" />
                <span className="w-10 text-xs text-stone-500">{b.satuan_pakai}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-2 rounded-2xl border-2 border-kopi-700 bg-white p-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-sm font-medium">
            Tanggal opname
            <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
          </label>
          <label className="text-sm font-medium">
            Catatan
            <input value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="mis. opname akhir Oktober" className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
          </label>
        </div>
        <p className="text-sm">
          {terisi.length} dari {bahan.length} bahan terisi · nilai persediaan <b>{formatRupiah(Math.round(nilai))}</b>
        </p>
        <button
          disabled={pending || !terisi.length}
          onClick={() =>
            confirm(`Simpan opname ${terisi.length} bahan? Stok outlet akan disesuaikan dengan hasil hitung.`) &&
            start(async () => {
              const r = await simpanOpname(outletId, tanggal, terisi.map((b) => ({ bahan_id: b.id, qty_fisik: num(isi[b.id]!)! })), catatan);
              setMsg(r);
              if (!r.error) {
                setIsi({});
                router.refresh();
              }
            })
          }
          className="w-full rounded-xl bg-kopi-900 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Menyimpan…" : "💾 Simpan hasil opname"}
        </button>
      </section>

      {riwayat.length > 0 && (
        <section className="rounded-2xl border border-matur-200 bg-white p-4">
          <h2 className="mb-2 font-bold">Riwayat opname</h2>
          <ul className="divide-y text-sm">
            {riwayat.map((r) => (
              <li key={r.id} className="flex justify-between py-1.5">
                <span>
                  {formatTanggal(r.tanggal)} {r.catatan && <span className="text-xs text-stone-500">· {r.catatan}</span>}
                </span>
                <b className="tabular-nums">{formatRupiah(r.total_nilai)}</b>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
