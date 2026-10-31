"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatRupiah } from "@/lib/format";
import { simpanResep } from "@/lib/menu-varian-actions";
import { hppResep, marginPersen, nadaMargin, type BahanHpp } from "@/lib/hpp-live";

const WARNA = { hijau: "bg-emerald-100 text-emerald-800", kuning: "bg-amber-100 text-amber-800", merah: "bg-red-100 text-red-700" };

/** Modal ubah resep dasar satu menu/kemasan; HPP & margin dihitung langsung dari harga bahan saat ini. */
export function EditorResep({
  menu,
  awal,
  bahan,
  onTutup,
}: {
  menu: { id: string; nama: string; harga_langsung: number; harga_ojol: number };
  awal: { bahan_id: string; takaran: number }[];
  bahan: BahanHpp[];
  onTutup: () => void;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [rows, setRows] = useState(awal.map((r) => ({ bahan_id: r.bahan_id, isi: String(r.takaran).replace(".", ",") })));
  const [cari, setCari] = useState("");
  const [err, setErr] = useState("");
  const peta = new Map(bahan.map((b) => [b.id, b]));
  const valid = rows.map((r) => ({ bahan_id: r.bahan_id, takaran: Number(r.isi.replace(",", ".")) }));
  const hpp = hppResep(valid.filter((r) => r.takaran > 0), peta);
  const mDine = marginPersen(menu.harga_langsung, hpp);
  const mOjol = marginPersen(menu.harga_ojol, hpp);
  const pilihan = bahan.filter((b) => !rows.some((r) => r.bahan_id === b.id) && b.nama.toLowerCase().includes(cari.toLowerCase()));
  const dirty = JSON.stringify(valid) !== JSON.stringify(awal.map((r) => ({ bahan_id: r.bahan_id, takaran: Number(r.takaran) })));

  const simpan = () => {
    if (valid.some((r) => !(r.takaran > 0) || r.takaran > 1_000_000)) return setErr("Takaran setiap bahan wajib lebih dari 0.");
    setErr("");
    start(async () => {
      try {
        const r = await simpanResep(menu.id, valid);
        if (r.error) setErr(r.error);
        else {
          router.refresh();
          onTutup();
        }
      } catch {
        setErr("Belum tersimpan. Periksa koneksi lalu coba lagi.");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/40 sm:place-items-center sm:p-4" role="dialog" aria-modal="true" aria-label={"Resep " + menu.nama} onClick={busy ? undefined : onTutup}>
      <div onClick={(e) => e.stopPropagation()} className="flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-white shadow-xl sm:max-w-2xl sm:rounded-3xl">
        <div className="flex items-start gap-3 border-b border-stone-100 p-4 sm:p-5">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-extrabold text-kopi-900">🧾 Resep · {menu.nama}</h2>
            <p className="text-xs text-stone-500">Takaran dalam satuan pakai (gram, ml, pcs). Dipakai POS untuk memotong stok dan menghitung HPP setiap penjualan.</p>
          </div>
          <button type="button" onClick={onTutup} disabled={busy} aria-label="Tutup" className="rounded-full px-2 text-xl text-stone-400 hover:text-stone-700">
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
          {!rows.length && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Belum ada bahan. Tanpa resep, penjualan menu ini tidak memotong stok dan HPP-nya Rp 0.</p>}
          <ul className="space-y-2">
            {rows.map((r, i) => {
              const b = peta.get(r.bahan_id);
              const t = Number(r.isi.replace(",", "."));
              return (
                <li key={r.bahan_id} className="grid grid-cols-[minmax(0,1fr)_7.5rem_auto] items-center gap-2 rounded-xl border border-matur-100 bg-matur-50/40 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-kopi-900">{b?.nama ?? "Bahan dihapus"}</p>
                    <p className="text-[11px] text-stone-500">
                      {b?.harga_pokok ? `${formatRupiah(Number(b.harga_pokok))}/${b.satuan_pakai}` : "HPP bahan belum ada"} · biaya <b className="text-kopi-800">{formatRupiah(t > 0 ? t * Number(b?.harga_pokok ?? 0) : 0)}</b>
                    </p>
                  </div>
                  <label className="relative block">
                    <span className="sr-only">Takaran {b?.nama}</span>
                    <input
                      inputMode="decimal"
                      value={r.isi}
                      placeholder="0"
                      onChange={(e) => setRows(rows.map((x, n) => (n === i ? { ...x, isi: e.target.value.replace(/[^0-9.,]/g, "") } : x)))}
                      className={`w-full rounded-lg border bg-white py-1.5 pl-2 pr-9 text-right text-sm tabular-nums outline-none focus:border-matur-500 ${t > 0 ? "border-matur-200" : "border-red-300"}`}
                    />
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-stone-400">{b?.satuan_pakai}</span>
                  </label>
                  <button type="button" aria-label={"Hapus " + (b?.nama ?? "bahan")} onClick={() => setRows(rows.filter((_, n) => n !== i))} className="rounded-lg px-2 py-1 text-sm font-semibold text-red-600 hover:bg-red-50">
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
          <details className="rounded-xl border border-dashed border-matur-300 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-matur-700">+ Tambah bahan</summary>
            <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="🔎 Cari bahan…" className="mt-2 w-full rounded-lg border border-matur-200 px-3 py-2 text-sm outline-none focus:border-matur-500" />
            <div className="mt-2 flex max-h-48 flex-wrap gap-1.5 overflow-y-auto">
              {pilihan.map((b) => (
                <button key={b.id} type="button" onClick={() => (setRows([...rows, { bahan_id: b.id, isi: "" }]), setCari(""))} className="rounded-full border border-matur-200 bg-white px-3 py-1.5 text-xs font-semibold text-kopi-800 hover:bg-matur-50">
                  {b.nama} <span className="font-normal text-stone-400">/{b.satuan_pakai}</span>
                </button>
              ))}
              {!pilihan.length && <p className="text-xs text-stone-500">Tidak ada bahan yang cocok.</p>}
            </div>
          </details>
        </div>
        <div className="space-y-2 border-t border-stone-100 p-4 sm:p-5">
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-xl bg-stone-50 p-2">
              <p className="text-stone-500">HPP</p>
              <b className="text-base tabular-nums text-kopi-900">{formatRupiah(hpp)}</b>
            </div>
            <div className="rounded-xl bg-stone-50 p-2">
              <p className="text-stone-500">Jual {formatRupiah(menu.harga_langsung)}</p>
              <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 font-bold ${WARNA[nadaMargin(mDine)]}`}>margin {mDine}%</span>
            </div>
            <div className="rounded-xl bg-stone-50 p-2">
              <p className="text-stone-500">Ojol {formatRupiah(menu.harga_ojol)}</p>
              <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 font-bold ${WARNA[nadaMargin(mOjol)]}`}>margin {mOjol}%</span>
            </div>
          </div>
          {err && <p role="alert" className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{err}</p>}
          <div className="flex gap-2">
            <button type="button" disabled={busy || !dirty} onClick={simpan} className="flex-1 rounded-xl bg-kopi-900 py-2.5 text-sm font-bold text-white disabled:opacity-50">
              {busy ? "Menyimpan…" : "Simpan resep"}
            </button>
            <button type="button" disabled={busy} onClick={onTutup} className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-semibold text-stone-700">
              Batal
            </button>
          </div>
          <p className="text-center text-[11px] text-stone-400">Tulis takaran tanpa titik ribuan; koma atau titik dipakai untuk desimal (mis. 18,5).</p>
        </div>
      </div>
    </div>
  );
}
