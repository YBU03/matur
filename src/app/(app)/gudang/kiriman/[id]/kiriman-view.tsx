"use client";

import {PengaturanCetakGudang,useCetakGudang} from "@/components/gudang-cetak";
import {PemeriksaKiriman} from "@/components/gudang-pemeriksa";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { STATUS_KIRIMAN, type ItemKiriman, type Kiriman } from "@/lib/kiriman";
import { batal, hapusItem, kirim, simpanInfo, tambahItem, terima, ubahItem, type Result } from "@/lib/kiriman-actions";
import type { Kop } from "@/lib/pdf-kop";
import { cetakDokumen } from "./dokumen";

type Bahan = { id: string; nama: string; satuan_beli: string; harga: number; stok: number };
const nf = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });
const cls = "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-matur-500";
const angka = (v: string) => Number(v.replace(",", "."));

export function KirimanView({ k, items, bahan, gudang, terimaBoleh, pt, namaSaya }: { k: Kiriman; items: ItemKiriman[]; bahan: Bahan[]; gudang: boolean; terimaBoleh: boolean; pt: Kop; namaSaya: string }) {
  const [cetak,setCetak]=useCetakGudang();
  const router = useRouter();
  const [msg, setMsg] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState("");
  const draft = k.status === "draft" && gudang;
  const run = (fn: () => Promise<Result>) =>
    start(async () => {
      const r = await fn();
      setMsg(r.error || r.ok ? r : null);
      router.refresh();
    });
  const total = items.reduce((s, i) => s + Math.round((k.status === "diterima" && i.qty_diterima !== null ? i.qty_diterima : i.qty) * i.harga), 0);
  const dok = async (j: "surat-jalan" | "invoice") => {
    setBusy(j);
    try {
      await cetakDokumen(j, k, items, pt,cetak);
    } catch {setMsg({error:"Dokumen belum dapat dibuat. Periksa ukuran kertas dan coba lagi."});} finally {
      setBusy("");
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/gudang/kiriman" className="inline-flex items-center gap-1 rounded-xl border border-matur-300 bg-white px-3 py-1.5 text-sm font-semibold text-matur-700">
        ← Semua kiriman
      </Link>
      <section className="rounded-2xl border border-matur-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="mr-auto text-xl font-bold">{k.nomor}</h1>
          <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${STATUS_KIRIMAN[k.status][1]}`}>{STATUS_KIRIMAN[k.status][0]}</span>
        </div>
        <p className="text-sm text-stone-600">
          Ke <b>{k.outlet?.nama}</b> · {formatTanggal(k.tanggal)}
          {k.dikirim_at && ` · dikirim ${formatTanggal(k.dikirim_at, true)}`}
          {k.diterima_at && ` · diterima ${formatTanggal(k.diterima_at, true)}${k.nama_penerima ? ` oleh ${k.nama_penerima}` : ""}`}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button disabled={!!busy || !items.length} onClick={() => dok("surat-jalan")} className="rounded-lg border border-kopi-700 px-3 py-1.5 text-sm font-semibold text-kopi-700 disabled:opacity-50">
            {busy === "surat-jalan" ? "Menyiapkan…" : "⬇ Surat Jalan"}
          </button>
          <button disabled={!!busy || !items.length} onClick={() => dok("invoice")} className="rounded-lg border border-matur-500 px-3 py-1.5 text-sm font-semibold text-matur-700 disabled:opacity-50">
            {busy === "invoice" ? "Menyiapkan…" : "⬇ Invoice"}
          </button>
        </div>
      </section>

      <PengaturanCetakGudang opsi={cetak} onChange={setCetak}/>
      {draft&&<PemeriksaKiriman id={k.id} nama={k.pemeriksa_nama??null}/>}
      {msg && <p className={`rounded-lg px-3 py-2 text-sm ${msg.error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>{msg.error ?? msg.ok}</p>}

      {draft && <InfoForm k={k} pending={pending} onSave={(d) => run(() => simpanInfo(k.id, d))} />}

      <section className="rounded-2xl border border-matur-200 bg-white p-4">
        <h2 className="mb-2 font-bold">Barang ({items.length})</h2>
        {items.length === 0 && <p className="py-2 text-sm text-stone-400">Belum ada barang.</p>}
        <ul className="divide-y">
          {items.map((i) =>
            draft ? (
              <ItemDraft key={i.id} i={i} pending={pending} onSave={(q, h) => run(() => ubahItem(k.id, i.id, q, h))} onHapus={() => run(() => hapusItem(k.id, i.id))} />
            ) : (
              <li key={i.id} className="flex items-start gap-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{i.nama}</p>
                  <p className="text-xs text-stone-500">
                    {nf.format(i.qty)} {i.satuan} × {formatRupiah(i.harga)}
                    {i.qty_diterima !== null && i.qty_diterima !== i.qty && <b className="ml-1 text-red-600">· diterima {nf.format(i.qty_diterima)}</b>}
                  </p>
                </div>
                <span className="font-semibold tabular-nums">{formatRupiah(Math.round((i.qty_diterima ?? i.qty) * i.harga))}</span>
              </li>
            ),
          )}
          {items.length > 0 && (
            <li className="flex justify-between py-2 font-bold">
              <span>Total</span>
              <span className="tabular-nums">{formatRupiah(total)}</span>
            </li>
          )}
        </ul>
        {draft && <TambahItem bahan={bahan} pending={pending} onAdd={(b, q, h) => run(() => tambahItem(k.id, b, q, h))} />}
      </section>

      {draft && (
        <div className="grid grid-cols-2 gap-2">
          <button disabled={pending} onClick={() => confirm("Batalkan kiriman draft ini?") && run(() => batal(k.id))} className="rounded-xl border border-red-200 bg-white py-3 text-sm font-semibold text-red-600">
            Batalkan
          </button>
          <button
            disabled={pending || !items.length}
            onClick={() => confirm(`Kirim ${items.length} barang ke ${k.outlet?.nama}? Stok gudang akan dikurangi.`) && run(() => kirim(k.id))}
            className="rounded-xl bg-matur-500 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            🚚 Kirim sekarang
          </button>
        </div>
      )}

      {terimaBoleh && <TerimaForm k={k} items={items} pending={pending} namaSaya={namaSaya} onTerima={(rows, nama) => run(() => terima(k.id, rows, nama))} />}
      {gudang && k.status === "dikirim" && (
        <button disabled={pending} onClick={() => confirm("Batalkan kiriman ini? Stok dikembalikan ke gudang.") && run(() => batal(k.id))} className="w-full rounded-xl border border-red-200 bg-white py-2.5 text-sm text-red-600">
          Batalkan kiriman (stok kembali ke gudang)
        </button>
      )}
    </div>
  );
}

function InfoForm({ k, pending, onSave }: { k: Kiriman; pending: boolean; onSave: (d: { tanggal: string; catatan: string; pengirim: string }) => void }) {
  const [d, setD] = useState({ tanggal: k.tanggal, catatan: k.catatan ?? "", pengirim: k.pengirim ?? "" });
  return (
    <section className="grid gap-2 rounded-2xl border border-matur-200 bg-white p-4 sm:grid-cols-3">
      <label className="text-sm font-medium">
        Tanggal
        <input type="date" value={d.tanggal} onChange={(e) => setD({ ...d, tanggal: e.target.value })} className={`mt-1 ${cls}`} />
      </label>
      <label className="text-sm font-medium">
        Pengirim / sopir
        <input value={d.pengirim} onChange={(e) => setD({ ...d, pengirim: e.target.value })} className={`mt-1 ${cls}`} />
      </label>
      <label className="text-sm font-medium">
        Catatan
        <input value={d.catatan} onChange={(e) => setD({ ...d, catatan: e.target.value })} className={`mt-1 ${cls}`} />
      </label>
      <button disabled={pending} onClick={() => onSave(d)} className="rounded-lg border border-matur-400 py-2 text-sm font-semibold text-matur-700 sm:col-span-3">
        Simpan info
      </button>
    </section>
  );
}

function ItemDraft({ i, pending, onSave, onHapus }: { i: ItemKiriman; pending: boolean; onSave: (q: number, h: number) => void; onHapus: () => void }) {
  const [q, setQ] = useState(String(i.qty));
  const [h, setH] = useState(String(i.harga));
  const ubah = angka(q) !== i.qty || angka(h) !== i.harga;
  return (
    <li className="space-y-1.5 py-2.5">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 font-medium">{i.nama}</p>
        <button disabled={pending} onClick={onHapus} className="rounded-lg px-2 py-1 text-sm text-red-600 hover:bg-red-50" title="Hapus">
          🗑
        </button>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <input value={q} onChange={(e) => setQ(e.target.value)} inputMode="decimal" className={`${cls} w-20 text-right`} />
        <span className="w-14 truncate text-xs text-stone-500">{i.satuan}</span>
        <span className="text-stone-400">×</span>
        <input value={h} onChange={(e) => setH(e.target.value)} inputMode="numeric" className={`${cls} w-28 text-right`} />
        <span className="ml-auto font-semibold tabular-nums">{formatRupiah(Math.round((angka(q) || 0) * (angka(h) || 0)))}</span>
      </div>
      {ubah && (
        <button disabled={pending} onClick={() => onSave(angka(q), angka(h))} className="rounded-lg bg-matur-500 px-3 py-1 text-xs font-semibold text-white">
          Simpan perubahan
        </button>
      )}
    </li>
  );
}

function TambahItem({ bahan, pending, onAdd }: { bahan: Bahan[]; pending: boolean; onAdd: (bahanId: string, qty: number, harga: number | null) => void }) {
  const [id, setId] = useState("");
  const [q, setQ] = useState("1");
  const b = bahan.find((x) => x.id === id);
  return (
    <div className="mt-3 space-y-2 rounded-xl bg-stone-50 p-3">
      <p className="text-sm font-semibold">+ Tambah barang</p>
      <select value={id} onChange={(e) => setId(e.target.value)} className={cls}>
        <option value="">— pilih bahan —</option>
        {bahan.map((x) => (
          <option key={x.id} value={x.id}>
            {x.nama} (stok gudang {nf.format(x.stok)} {x.satuan_beli})
          </option>
        ))}
      </select>
      {b && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <input value={q} onChange={(e) => setQ(e.target.value)} inputMode="decimal" className={`${cls} w-24 text-right`} />
          <span className="text-stone-500">{b.satuan_beli} × {formatRupiah(b.harga)}</span>
          {angka(q) > b.stok && <span className="w-full text-xs text-amber-700">⚠️ Melebihi stok gudang ({nf.format(b.stok)} {b.satuan_beli}).</span>}
          <button
            disabled={pending || !(angka(q) > 0)}
            onClick={() => {
              onAdd(b.id, angka(q), null);
              setId("");
              setQ("1");
            }}
            className="ml-auto rounded-lg bg-matur-500 px-4 py-2 font-semibold text-white disabled:opacity-50"
          >
            Tambah
          </button>
        </div>
      )}
    </div>
  );
}

function TerimaForm({ k, items, pending, namaSaya, onTerima }: { k: Kiriman; items: ItemKiriman[]; pending: boolean; namaSaya: string; onTerima: (rows: { id: string; qty_diterima: number }[], nama: string) => void }) {
  const [qty, setQty] = useState<Record<string, string>>(Object.fromEntries(items.map((i) => [i.id, String(i.qty)])));
  const [nama, setNama] = useState(namaSaya);
  const kurang = items.filter((i) => angka(qty[i.id] ?? "") < i.qty);
  return (
    <section className="space-y-3 rounded-2xl border-2 border-green-300 bg-green-50 p-4">
      <h2 className="font-bold">Terima kiriman</h2>
      <p className="text-xs text-stone-600">Cek barang yang datang. Ubah jumlahnya bila ada yang kurang atau rusak; selisihnya kembali ke stok gudang.</p>
      <ul className="divide-y divide-green-200">
        {items.map((i) => (
          <li key={i.id} className="flex items-center gap-2 py-2 text-sm">
            <span className="min-w-0 flex-1">{i.nama}</span>
            <input value={qty[i.id]} onChange={(e) => setQty({ ...qty, [i.id]: e.target.value })} inputMode="decimal" className={`${cls} w-20 bg-white text-right`} />
            <span className="w-16 text-xs text-stone-500">/ {nf.format(i.qty)} {i.satuan}</span>
          </li>
        ))}
      </ul>
      <label className="block text-sm font-medium">
        Nama penerima
        <input value={nama} onChange={(e) => setNama(e.target.value)} className={`mt-1 ${cls} bg-white`} />
      </label>
      {kurang.length > 0 && <p className="text-xs text-amber-800">⚠️ {kurang.length} barang diterima kurang dari jumlah kirim.</p>}
      <button
        disabled={pending || items.some((i) => !(angka(qty[i.id] ?? "") >= 0))}
        onClick={() => confirm(`Konfirmasi kiriman ${k.nomor} sudah diterima?`) && onTerima(items.map((i) => ({ id: i.id, qty_diterima: angka(qty[i.id]) })), nama)}
        className="w-full rounded-xl bg-green-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        ✅ Barang sudah diterima
      </button>
    </section>
  );
}
