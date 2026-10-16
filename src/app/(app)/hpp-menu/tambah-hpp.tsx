"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { tambahHpp } from "@/lib/hpp-actions";
import { formatRupiah } from "@/lib/format";
type Bahan = { id: string; nama: string; satuan_pakai: string; harga_pokok: number };
export function TambahHpp({ menus, bahan, kategori }: { menus: { id: string; nama: string; harga_langsung: number }[]; bahan: Bahan[]; kategori: { id: string; nama: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ menu_id: "", nama: "", kategori_id: "", harga: "", harga_ojol: "", seri: "Ice" });
  const [rows, setRows] = useState([{ id: "", qty: "" }]);
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});
  const total = rows.reduce((s, r) => s + Number(r.qty || 0) * Number(bahan.find((b) => b.id === r.id)?.harga_pokok ?? 0), 0);
  const harga = v.menu_id ? menus.find((m) => m.id === v.menu_id)?.harga_langsung ?? 0 : Number(v.harga);
  const cls = "mt-0.5 w-full rounded-xl border border-matur-200 bg-white px-3 py-2 text-sm outline-none focus:border-matur-500 focus:ring-2 focus:ring-matur-100";
  return <section className="rounded-2xl border border-matur-100 bg-white p-4 shadow-sm">
    <button onClick={() => setOpen(!open)} className="rounded-xl bg-kopi-900 px-4 py-2 font-semibold text-white">{open ? "Tutup form" : "+ Tambah HPP"}</button>
    {open && <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); start(async () => {
      const r = await tambahHpp({ ...v, harga: Number(v.harga), harga_ojol: Number(v.harga_ojol), bahan: rows.map((r) => ({ id: r.id, qty: Number(r.qty) })) });
      setMsg(r); if (!r.error) { setRows([{ id: "", qty: "" }]); router.refresh(); }
    }); }}>
      <p className="text-sm text-stone-600">Pilih menu yang belum memiliki resep, atau buat menu POS baru. Bahan dan takaran ini menjadi resep pemotong stok saat menu terjual. Untuk resep Hot/Can berbeda, buat menu POS tersendiri.</p>
      <label className="block">Menu POS<select className={cls} value={v.menu_id} onChange={(e) => setV({ ...v, menu_id: e.target.value })}><option value="">+ Buat menu baru</option>{menus.map((m) => <option key={m.id} value={m.id}>{m.nama}</option>)}</select></label>
      {!v.menu_id && <div className="grid gap-3 sm:grid-cols-2">
        <label>Nama menu<input required maxLength={100} className={cls} value={v.nama} onChange={(e) => setV({ ...v, nama: e.target.value })} /></label>
        <label>Kategori<select className={cls} value={v.kategori_id} onChange={(e) => setV({ ...v, kategori_id: e.target.value })}><option value="">Tanpa kategori</option>{kategori.map((k) => <option key={k.id} value={k.id}>{k.nama}</option>)}</select></label>
        <label>Harga jual langsung<input required type="number" min="1" step="1" className={cls} value={v.harga} onChange={(e) => setV({ ...v, harga: e.target.value })} /></label>
        <label>Harga ojol<input required type="number" min="1" step="1" className={cls} value={v.harga_ojol} onChange={(e) => setV({ ...v, harga_ojol: e.target.value })} /></label>
      </div>}
      <label className="block">Seri<select className={cls} value={v.seri} onChange={(e) => setV({ ...v, seri: e.target.value })}>{["Ice", "Hot", "Can"].map((s) => <option key={s}>{s}</option>)}</select></label>
      {rows.map((r, i) => <div key={i} className="flex flex-wrap items-end gap-2">
        <label className="min-w-40 flex-1">Bahan<select required className={cls} value={r.id} onChange={(e) => setRows(rows.map((x, j) => i === j ? { ...x, id: e.target.value } : x))}><option value="">Pilih bahan</option>{bahan.map((b) => <option key={b.id} value={b.id} disabled={rows.some((x, j) => j !== i && x.id === b.id)}>{b.nama} ({b.satuan_pakai})</option>)}</select></label>
        <label>Takaran ({bahan.find((b) => b.id === r.id)?.satuan_pakai ?? "satuan pakai"})<input required type="number" min="0.0001" max="1000000" step="0.0001" className={cls} value={r.qty} onChange={(e) => setRows(rows.map((x, j) => i === j ? { ...x, qty: e.target.value } : x))} /></label>
        <button type="button" disabled={rows.length === 1} onClick={() => setRows(rows.filter((_, j) => j !== i))} className="p-2 text-red-700">Hapus bahan</button>
      </div>)}
      <button type="button" onClick={() => setRows([...rows, { id: "", qty: "" }])} className="text-matur-700 underline">+ Bahan</button>
      <p className="font-semibold">HPP {formatRupiah(total)} · Margin {harga > 0 ? Math.round((harga - total) / harga * 100) : 0}%</p>
      <button disabled={pending} className="rounded-xl bg-matur-500 px-4 py-2 font-bold text-white disabled:opacity-50">{pending ? "Menyimpan…" : "Simpan HPP & Resep POS"}</button>
    </form>}
    {(msg.error || msg.ok) && <p role="status" className={`mt-3 text-sm ${msg.error ? "text-red-700" : "text-green-700"}`}>{msg.error ?? msg.ok}</p>}
  </section>;
}
