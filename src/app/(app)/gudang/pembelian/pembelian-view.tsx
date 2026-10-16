"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge, ChipHeader, HeaderHalaman, Kosong, isian, tombolHeader } from "@/components/ui-halaman";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { batalPembelian, simpanItemPembelian, terimaPembelian } from "@/lib/gudang-actions";

type Bahan = { id: string; nama: string; satuan_beli: string; satuan_pakai: string; konversi: number; harga_beli: number | null; supplier_id: string | null };
type Item = { bahan_id: string; qty: string; harga: string };
const STATUS: Record<string, [string, "netral" | "hijau" | "merah"]> = { draft: ["Draft", "netral"], diterima: ["Diterima", "hijau"], batal: ["Batal", "merah"] };
const nf = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });
const angka = (v: string) => Number(v.replace(/\./g, "").replace(",", ".")) || 0;

export function PembelianView({
  pembelian: g,
  items,
  bahan,
  supplier,
  bisaUbah,
}: {
  pembelian: { id: string; nomor: string; tanggal: string; status: string; no_faktur: string | null; catatan: string | null; total: number; supplier_id: string | null };
  items: { bahan_id: string; qty: number; harga: number }[];
  bahan: Bahan[];
  supplier: { id: string; nama: string }[];
  bisaUbah: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ error?: string; ok?: string } | null>(null);
  const [rows, setRows] = useState<Item[]>(items.map((i) => ({ bahan_id: i.bahan_id, qty: String(i.qty), harga: String(i.harga) })));
  const [sup, setSup] = useState(g.supplier_id ?? "");
  const [faktur, setFaktur] = useState(g.no_faktur ?? "");
  const [catatan, setCatatan] = useState(g.catatan ?? "");
  const [cari, setCari] = useState("");
  const draft = g.status === "draft" && bisaUbah;
  const bmap = new Map(bahan.map((b) => [b.id, b]));
  const total = rows.reduce((t, r) => t + Math.round(angka(r.qty) * angka(r.harga)), 0);
  const saran = cari ? bahan.filter((b) => b.nama.toLowerCase().includes(cari.toLowerCase()) && !rows.some((r) => r.bahan_id === b.id)).slice(0, 8) : [];
  const jalankan = (fn: () => Promise<{ error?: string; ok?: string }>) =>
    start(async () => {
      const r = await fn();
      setMsg(r);
      if (!r.error) router.refresh();
    });
  const simpan = () => simpanItemPembelian(g.id, rows.map((r) => ({ bahan_id: r.bahan_id, qty: angka(r.qty), harga: angka(r.harga) })), { no_faktur: faktur, catatan, supplier_id: sup || null });

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <HeaderHalaman
        judul={g.nomor}
        ikon="🛒"
        keterangan="Pembelian bahan ke supplier. Saat ditandai diterima, stok gudang bertambah."
        aksi={
          <Link href="/gudang/pembelian" className={tombolHeader}>
            ← Semua pembelian
          </Link>
        }
      >
        <ChipHeader>{formatTanggal(g.tanggal)}</ChipHeader>
        <ChipHeader>{STATUS[g.status]?.[0] ?? g.status}</ChipHeader>
        <ChipHeader>{formatRupiah(draft ? total : g.total)}</ChipHeader>
      </HeaderHalaman>
      {msg && <p className={`rounded-xl px-3 py-2 text-sm ${msg.error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{msg.error ?? msg.ok}</p>}

      <section className="grid gap-3 rounded-2xl border border-matur-100 bg-white p-3 shadow-sm sm:grid-cols-3 sm:p-4">
        <label className="text-xs font-medium text-stone-600">
          Supplier
          <select disabled={!draft} value={sup} onChange={(e) => setSup(e.target.value)} className={`${isian} mt-0.5 block w-full disabled:bg-stone-50`}>
            <option value="">— tanpa supplier —</option>
            {supplier.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nama}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-stone-600">
          No. faktur/nota
          <input disabled={!draft} value={faktur} onChange={(e) => setFaktur(e.target.value)} className={`${isian} mt-0.5 block w-full disabled:bg-stone-50`} />
        </label>
        <label className="text-xs font-medium text-stone-600">
          Catatan
          <input disabled={!draft} value={catatan} onChange={(e) => setCatatan(e.target.value)} className={`${isian} mt-0.5 block w-full disabled:bg-stone-50`} />
        </label>
      </section>

      <section className="rounded-2xl border border-matur-100 bg-white p-3 shadow-sm sm:p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="font-bold text-kopi-900">Barang</h2>
          <Badge nada={STATUS[g.status]?.[1] ?? "netral"}>{STATUS[g.status]?.[0] ?? g.status}</Badge>
        </div>
        {draft && (
          <div className="relative mb-2">
            <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="🔍 Tambah bahan: ketik nama…" className={`${isian} w-full`} />
            {saran.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-matur-100 bg-white shadow-lg">
                {saran.map((b) => (
                  <li key={b.id}>
                    <button onClick={() => (setRows([...rows, { bahan_id: b.id, qty: "1", harga: String(b.harga_beli ?? "") }]), setCari(""))} className="flex w-full justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-matur-50">
                      <span>{b.nama}</span>
                      <span className="text-xs text-stone-500">
                        {b.satuan_beli}
                        {b.harga_beli ? ` · terakhir ${formatRupiah(b.harga_beli)}` : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {rows.length === 0 && <Kosong ikon="📦" judul="Belum ada barang.">{draft ? "Cari bahan di atas untuk menambahkannya." : null}</Kosong>}
        <ul className="divide-y divide-stone-100">
          {rows.map((r, i) => {
            const b = bmap.get(r.bahan_id);
            const set = (k: keyof Item, v: string) => setRows(rows.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
            return (
              <li key={r.bahan_id} className="flex flex-wrap items-center gap-x-2 gap-y-1.5 py-2.5 text-sm">
                <div className="min-w-0 basis-full sm:basis-auto sm:flex-1">
                  <p className="font-medium text-kopi-900">{b?.nama ?? "?"}</p>
                  {b && b.konversi > 1 && <p className="text-xs text-stone-500">1 {b.satuan_beli} = {nf.format(b.konversi)} {b.satuan_pakai}</p>}
                </div>
                <input disabled={!draft} value={r.qty} onChange={(e) => set("qty", e.target.value)} inputMode="decimal" aria-label="Jumlah" className="w-16 rounded-lg border border-matur-200 px-2 py-1 text-right disabled:bg-stone-50" />
                <span className="text-xs text-stone-500">{b?.satuan_beli}</span>
                <span className="text-xs text-stone-400">×</span>
                <input disabled={!draft} value={r.harga} onChange={(e) => set("harga", e.target.value)} inputMode="numeric" placeholder="harga" aria-label="Harga" className="min-w-0 flex-1 rounded-lg border border-matur-200 px-2 py-1 text-right disabled:bg-stone-50 sm:w-28 sm:flex-none" />
                <b className="ml-auto text-right tabular-nums text-kopi-900 sm:min-w-24">{formatRupiah(Math.round(angka(r.qty) * angka(r.harga)))}</b>
                {draft && (
                  <button onClick={() => setRows(rows.filter((_, j) => j !== i))} className="rounded-lg px-1.5 text-red-600 hover:bg-red-50" aria-label="Hapus">
                    ✕
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-2 flex justify-between border-t border-matur-100 pt-3 text-base font-bold text-kopi-900">
          <span>Total</span>
          <span className="tabular-nums">{formatRupiah(draft ? total : g.total)}</span>
        </p>
      </section>

      {draft && (
        <div className="flex flex-wrap justify-end gap-2">
          <button disabled={pending} onClick={() => confirm("Batalkan pembelian ini?") && jalankan(() => batalPembelian(g.id))} className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">
            Batalkan
          </button>
          <button disabled={pending} onClick={() => jalankan(simpan)} className="rounded-xl border border-matur-300 bg-white px-4 py-2 text-sm font-semibold text-matur-700 hover:bg-matur-50">
            💾 Simpan draft
          </button>
          <button
            disabled={pending || !rows.length}
            onClick={() =>
              confirm(`Tandai barang sudah diterima? Stok gudang bertambah ${rows.length} bahan, total ${formatRupiah(total)}.`) &&
              jalankan(async () => {
                const r = await simpan();
                return r.error ? r : terimaPembelian(g.id);
              })
            }
            className="rounded-xl bg-kopi-900 px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
          >
            ✅ Barang diterima
          </button>
        </div>
      )}
    </div>
  );
}
