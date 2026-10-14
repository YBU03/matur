"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatRupiah } from "@/lib/format";
import { catatTitipan } from "@/lib/titipan-actions";

export type RekapTitipan = { menu_id: string; nama: string; produsen: string; harga: number; masuk: number; terjual: number; sisa: number; tagihan: number };

export function TitipanView({
  outletId,
  bulan,
  rekap,
  menu,
  riwayat,
}: {
  outletId: string;
  bulan: string;
  rekap: RekapTitipan[];
  menu: { id: string; nama: string; produsen: string | null; harga_titip: number }[];
  riwayat: { id: string; menu_id: string; tanggal: string; qty: number; catatan: string | null; nama_pembuat: string | null; created_at: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ error?: string; ok?: string } | null>(null);
  const [f, setF] = useState({ menu: menu[0]?.id ?? "", qty: "", tanggal: new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10), catatan: "", retur: false });
  const produsen = [...new Set(rekap.map((r) => r.produsen))];
  const nama = new Map(menu.map((m) => [m.id, m.nama]));
  const total = rekap.reduce((t, r) => t + r.tagihan, 0);

  if (!menu.length)
    return (
      <p className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        Belum ada menu titipan. Buka <Link href="/master/menu" className="font-semibold underline">Data Menu</Link>, ubah menu cheesecake/dessert lalu centang <b>Produk titipan</b>, isi <b>Produsen</b> dan <b>Harga dari produsen / pcs</b>.
      </p>
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input type="month" value={bulan} onChange={(e) => e.target.value && router.push(`/titipan?outlet=${outletId}&bulan=${e.target.value}`)} className="rounded-lg border border-matur-200 bg-white px-3 py-2 text-sm" />
        <span className="ml-auto rounded-xl bg-kopi-900 px-4 py-2 text-sm font-semibold text-white">Tagihan bulan ini: {formatRupiah(total)}</span>
      </div>

      {produsen.map((pr) => {
        const xs = rekap.filter((r) => r.produsen === pr);
        return (
          <section key={pr} className="overflow-x-auto rounded-2xl border border-matur-200 bg-white p-3">
            <h2 className="mb-2 font-bold">Produsen: {pr}</h2>
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-stone-500">
                <tr>
                  <th className="py-1">Produk</th>
                  <th className="text-right">Masuk</th>
                  <th className="text-right">Terjual</th>
                  <th className="text-right">Sisa di outlet</th>
                  <th className="text-right">Harga/pcs</th>
                  <th className="text-right">Tagihan</th>
                </tr>
              </thead>
              <tbody>
                {xs.map((r) => (
                  <tr key={r.menu_id} className="border-t">
                    <td className="py-1.5 font-medium">{r.nama}</td>
                    <td className="text-right tabular-nums">{r.masuk}</td>
                    <td className="text-right font-semibold tabular-nums">{r.terjual}</td>
                    <td className={`text-right tabular-nums ${r.sisa < 0 ? "text-red-600" : ""}`}>{r.sisa}</td>
                    <td className="text-right tabular-nums">{formatRupiah(r.harga)}</td>
                    <td className="text-right font-semibold tabular-nums">{formatRupiah(r.tagihan)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 font-bold">
                  <td className="py-1.5" colSpan={5}>
                    Total tagihan ke {pr}
                  </td>
                  <td className="text-right tabular-nums">{formatRupiah(xs.reduce((t, r) => t + r.tagihan, 0))}</td>
                </tr>
              </tbody>
            </table>
            {xs.some((r) => r.sisa < 0) && <p className="mt-1 text-xs text-red-600">Sisa minus: penjualan lebih banyak dari setoran tercatat — cek setoran yang belum diinput.</p>}
          </section>
        );
      })}

      <section className="space-y-2 rounded-2xl border border-matur-200 bg-white p-4">
        <h2 className="font-bold">Catat setoran dari produsen</h2>
        <div className="grid gap-2 sm:grid-cols-4">
          <select value={f.menu} onChange={(e) => setF({ ...f, menu: e.target.value })} className="rounded-lg border border-stone-300 px-2 py-2 text-sm sm:col-span-2">
            {menu.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nama} {m.produsen ? `· ${m.produsen}` : ""}
              </option>
            ))}
          </select>
          <input value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} inputMode="numeric" placeholder="jumlah pcs" className="rounded-lg border border-stone-300 px-2 py-2 text-sm" />
          <input type="date" value={f.tanggal} onChange={(e) => setF({ ...f, tanggal: e.target.value })} className="rounded-lg border border-stone-300 px-2 py-2 text-sm" />
          <input value={f.catatan} onChange={(e) => setF({ ...f, catatan: e.target.value })} placeholder="catatan (opsional)" className="rounded-lg border border-stone-300 px-2 py-2 text-sm sm:col-span-3" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.retur} onChange={(e) => setF({ ...f, retur: e.target.checked })} /> retur / tarik kembali
          </label>
        </div>
        {msg && <p className={`rounded-lg px-3 py-2 text-sm ${msg.error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>{msg.error ?? msg.ok}</p>}
        <button
          disabled={pending || !f.menu || !Number(f.qty)}
          onClick={() =>
            start(async () => {
              const r = await catatTitipan(outletId, f.menu, (f.retur ? -1 : 1) * Math.abs(Number(f.qty)), f.tanggal, f.catatan);
              setMsg(r);
              if (!r.error) {
                setF({ ...f, qty: "", catatan: "", retur: false });
                router.refresh();
              }
            })
          }
          className="w-full rounded-xl bg-matur-500 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {f.retur ? "Catat retur" : "Catat setoran masuk"}
        </button>
        <p className="text-xs text-stone-500">Setoran titipan jangan dicatat sebagai pengeluaran “Bahan Baku” agar tidak terhitung dua kali — tagihannya otomatis masuk HPP dari jumlah terjual.</p>
      </section>

      {riwayat.length > 0 && (
        <section className="rounded-2xl border border-matur-200 bg-white p-4">
          <h2 className="mb-2 font-bold">Riwayat setoran bulan ini</h2>
          <ul className="divide-y text-sm">
            {riwayat.map((r) => (
              <li key={r.id} className="flex flex-wrap justify-between gap-2 py-1.5">
                <span>
                  {new Date(r.tanggal + "T00:00:00").toLocaleDateString("id-ID", { day: "2-digit", month: "short" })} · <b>{nama.get(r.menu_id) ?? "?"}</b>
                  <span className="text-xs text-stone-500">
                    {" "}
                    · {r.nama_pembuat ?? "-"}
                    {r.catatan && ` · ${r.catatan}`}
                  </span>
                </span>
                <span className={`tabular-nums ${r.qty < 0 ? "text-red-600" : "text-green-700"}`}>
                  {r.qty > 0 ? "+" : ""}
                  {r.qty} pcs
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
