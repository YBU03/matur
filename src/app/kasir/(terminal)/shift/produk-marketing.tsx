"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatRupiah } from "@/lib/format";
import { catatProdukKeluar, hapusProdukKeluar } from "@/lib/harian-actions";

export type ProdukHariIni = { id: string; jenis: string; penerima: string | null; items: { nama: string; qty: number }[]; total_hpp: number; nama_pembuat: string | null; catatan: string | null };
const JENIS: Record<string, string> = { endorse: "Barter endorse", endorse_fee: "Endorse + fee", sampel: "Sampel / tester", promo: "Promo", lainnya: "Lainnya" };
const cls = "w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm outline-none focus:border-matur-500";

// Produk yang diberikan untuk marketing (influencer/endorse/sampel): dicatat barista/kasir per produk, stok bahan terpotong sesuai resep.
// Fee influencer (uang) tetap dicatat pusat/akunting sebagai pengeluaran kategori Marketing.
export function ProdukMarketing({ outletId, menu, data, spv }: { outletId: string; menu: { id: string; nama: string }[]; data: ProdukHariIni[]; spv: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [buka, setBuka] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);
  const kosong = { penerima: "", jenis: "endorse", catatan: "", items: [{ menu_id: "", qty: "1", cari: "" }] };
  const [f, setF] = useState(kosong);
  const run = (fn: () => Promise<{ ok?: string; error?: string }>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setMsg(r);
      if (!r.error) {
        after?.();
        router.refresh();
      }
    });
  const set = (i: number, v: Partial<(typeof f.items)[number]>) => setF({ ...f, items: f.items.map((x, j) => (j === i ? { ...x, ...v } : x)) });

  return (
    <section className="rounded-2xl border border-pink-200 bg-white p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 className="mr-auto font-bold">🎁 Produk marketing / endorse hari ini ({data.length})</h2>
        {!buka && (
          <button onClick={() => (setMsg(null), setBuka(true))} className="rounded-xl bg-pink-600 px-3 py-2 text-sm font-semibold text-white">
            + Catat produk
          </button>
        )}
      </div>
      {msg && <p className={`mb-2 rounded-lg px-3 py-2 text-sm ${msg.error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>{msg.error ?? msg.ok}</p>}
      {buka && (
        <div className="mb-3 space-y-2 rounded-xl bg-pink-50 p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <input value={f.penerima} onChange={(e) => setF({ ...f, penerima: e.target.value })} placeholder="Penerima, mis. @kulinerpurbalingga" className={cls} />
            <select value={f.jenis} onChange={(e) => setF({ ...f, jenis: e.target.value })} className={cls}>
              {Object.entries(JENIS).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          {f.items.map((it, i) => {
            const pilihan = menu.filter((m) => !it.cari || m.nama.toLowerCase().includes(it.cari.toLowerCase()));
            return (
              <div key={i} className="flex gap-1.5">
                <div className="min-w-0 flex-1">
                  <input value={it.cari} onChange={(e) => set(i, { cari: e.target.value })} placeholder="cari produk…" className={`${cls} mb-1 py-1.5`} />
                  <select value={it.menu_id} onChange={(e) => set(i, { menu_id: e.target.value })} className={cls}>
                    <option value="">— pilih produk —</option>
                    {pilihan.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nama}
                      </option>
                    ))}
                  </select>
                </div>
                <input value={it.qty} onChange={(e) => set(i, { qty: e.target.value.replace(/\D/g, "") })} inputMode="numeric" className={`${cls} w-16 self-end text-right`} aria-label="Jumlah" />
                {f.items.length > 1 && (
                  <button onClick={() => setF({ ...f, items: f.items.filter((_, j) => j !== i) })} className="self-end px-2 pb-2.5 text-red-600" aria-label="Hapus baris">
                    ✕
                  </button>
                )}
              </div>
            );
          })}
          <button onClick={() => setF({ ...f, items: [...f.items, { menu_id: "", qty: "1", cari: "" }] })} className="text-sm font-semibold text-pink-700">
            + produk lain
          </button>
          <input value={f.catatan} onChange={(e) => setF({ ...f, catatan: e.target.value })} placeholder="Catatan (mis. konten reels 1x)" className={cls} />
          <div className="flex justify-end gap-2">
            <button onClick={() => (setBuka(false), setF(kosong))} className="rounded-xl border px-4 py-2 text-sm">
              Batal
            </button>
            <button
              disabled={pending}
              onClick={() =>
                run(
                  () => catatProdukKeluar({ outlet_id: outletId, jenis: f.jenis, penerima: f.penerima, catatan: f.catatan, items: f.items.filter((x) => x.menu_id && Number(x.qty) > 0).map((x) => ({ menu_id: x.menu_id, qty: Number(x.qty) })) }),
                  () => (setBuka(false), setF(kosong)),
                )
              }
              className="rounded-xl bg-pink-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Simpan
            </button>
          </div>
          <p className="text-xs text-stone-500">Stok bahan terpotong sesuai resep dan tercatat di Catatan Harian. Fee influencer dicatat oleh pusat/akunting.</p>
        </div>
      )}
      {data.length === 0 && !buka && <p className="text-sm text-stone-500">Belum ada produk yang diberikan untuk marketing hari ini.</p>}
      <ul className="divide-y text-sm">
        {data.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-2 py-2">
            <span className="mr-auto">
              <b>{p.penerima ?? "-"}</b> · {JENIS[p.jenis] ?? p.jenis}
              <span className="block text-xs text-stone-500">
                {p.items.map((i) => `${i.qty}x ${i.nama}`).join(", ")} · oleh {p.nama_pembuat ?? "-"}
                {p.catatan ? ` · ${p.catatan}` : ""}
              </span>
            </span>
            <span className="tabular-nums text-xs text-stone-500">HPP {formatRupiah(p.total_hpp)}</span>
            {spv && (
              <button disabled={pending} onClick={() => confirm("Batalkan? Stok dikembalikan.") && run(() => hapusProdukKeluar(p.id))} className="rounded px-1.5 text-red-600">
                ✕
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
