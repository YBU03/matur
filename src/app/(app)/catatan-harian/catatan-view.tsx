"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Modal } from "@/components/confirm-edit";
import { FormPengeluaran, label } from "@/components/form-pengeluaran";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { catatPengeluaran, hapusPengeluaran, ubahPengeluaran, type Result } from "@/lib/kas-actions";

export type Hari = {
  tanggal: string;
  transaksi: number;
  tunai: number;
  non_tunai: number;
  gofood: number;
  grabfood: number;
  shopeefood: number;
  tiktok: number;
  ruma_app: number;
  tumbler: number;
  diskon: number;
  setoran: number | null;
  seharusnya: number | null;
  selisih: number | null;
  shift: number;
};
export type Biaya = { id: string; tanggal: string; kategori_id: string; jumlah: number; keterangan: string | null; sumber: "laci" | "pusat"; created_at: string; pengguna: { nama: string } | null };
type Kat = { id: string; nama: string; grup: string; urutan: number };

export const KANAL: [keyof Hari, string][] = [
  ["tunai", "Tunai"],
  ["non_tunai", "Non Tunai"],
  ["gofood", "Go Food"],
  ["grabfood", "Grab Food"],
  ["tiktok", "Tiktok Go"],
  ["ruma_app", "Ruma App"],
  ["shopeefood", "Shopee Food"],
  ["tumbler", "Tumbler"],
];
const jual = (h: Hari) => KANAL.reduce((s, [k]) => s + Number(h[k] ?? 0), 0);

export function CatatanHarian({ outlets, outletId, bulan, sim, bolehSim, hari, biaya, kategori }: { outlets: { id: string; nama: string }[]; outletId: string; bulan: string; sim: boolean; bolehSim: boolean; hari: Hari[]; biaya: Biaya[]; kategori: Kat[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Result | null>(null);
  const [buka, setBuka] = useState<string | null>(null);
  const [form, setForm] = useState<{ tanggal: string; item?: Biaya } | null>(null);
  const [busy, setBusy] = useState(false);
  const kat = Object.fromEntries(kategori.map((k) => [k.id, k]));
  const perHari = useMemo(() => {
    const m = new Map<string, Biaya[]>();
    biaya.forEach((b) => m.set(b.tanggal, [...(m.get(b.tanggal) ?? []), b]));
    return m;
  }, [biaya]);
  const run = (fn: () => Promise<Result>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setMsg(r);
      if (!r.error) {
        after?.();
        router.refresh();
      }
    });
  const pindah = (q: Record<string, string>) => router.push(`/catatan-harian?${new URLSearchParams({ outlet: outletId, bulan, ...(sim ? { sim: "1" } : {}), ...q })}`);

  const totalJual = hari.reduce((s, h) => s + jual(h), 0);
  const totalDiskon = hari.reduce((s, h) => s + h.diskon, 0);
  const grup = (g: string) => biaya.filter((b) => kat[b.kategori_id]?.grup === g).reduce((s, b) => s + b.jumlah, 0);
  const selisihKas = hari.reduce((s, h) => s + (h.selisih ?? 0), 0);
  const perKategori = kategori.map((k) => ({ k, total: biaya.filter((b) => b.kategori_id === k.id).reduce((s, b) => s + b.jumlah, 0) })).filter((x) => x.total > 0);
  const hariTampil = [...hari].reverse();
  const outletNama = outlets.find((o) => o.id === outletId)?.nama ?? "";

  const unduh = async () => {
    setBusy(true);
    try {
      const { eksporExcel } = await import("./ekspor");
      await eksporExcel(outletNama, bulan, hari, biaya, kategori);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto">
          <h1 className="text-2xl font-bold">Catatan Harian</h1>
          <p className="text-sm text-stone-500">Penjualan dari kasir, pengeluaran harian, dan setoran kas — dasar laporan keuangan bulanan.</p>
        </div>
        <button disabled={busy} onClick={unduh} className="rounded-xl border border-green-600 bg-white px-3 py-2 text-sm font-semibold text-green-700 disabled:opacity-50">
          {busy ? "Menyiapkan…" : "⬇ Excel (format Ruma)"}
        </button>
      </div>

      <section className="flex flex-wrap items-center gap-2 rounded-2xl border border-matur-200 bg-white p-3">
        {outlets.length > 1 && (
          <select value={outletId} onChange={(e) => pindah({ outlet: e.target.value })} className="rounded-lg border px-3 py-2 text-sm">
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nama}
              </option>
            ))}
          </select>
        )}
        <input type="month" value={bulan} onChange={(e) => e.target.value && pindah({ bulan: e.target.value })} className="rounded-lg border px-3 py-2 text-sm" />
        {bolehSim && (
          <label className="ml-auto flex items-center gap-2 text-sm">
            <input type="checkbox" checked={sim} onChange={(e) => pindah({ sim: e.target.checked ? "1" : "" })} className="accent-matur-500" />
            Data simulasi
          </label>
        )}
      </section>
      {msg && <p className={`rounded-lg px-3 py-2 text-sm ${msg.error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>{msg.error ?? msg.ok}</p>}

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Penjualan (sebelum diskon)", formatRupiah(totalJual), `diskon ${formatRupiah(totalDiskon)}`],
          ["Belanja bahan (HPP)", formatRupiah(grup("hpp")), "es kristal, bahan baku, galon"],
          ["Beban operasional", formatRupiah(grup("beban")), `${perKategori.filter((x) => x.k.grup === "beban").length} kategori`],
          ["Selisih kas", formatRupiah(selisihKas), selisihKas === 0 ? "pas" : selisihKas > 0 ? "lebih" : "kurang"],
        ].map(([k, v, sub]) => (
          <div key={k} className="rounded-2xl border border-matur-200 bg-white p-3">
            <p className="text-xs text-stone-500">{k}</p>
            <p className="font-bold">{v}</p>
            <p className="text-[11px] text-stone-400">{sub}</p>
          </div>
        ))}
      </section>

      {perKategori.length > 0 && (
        <section className="rounded-2xl border border-matur-200 bg-white p-4">
          <h2 className="mb-2 font-bold">Total pengeluaran per kategori</h2>
          <ul className="grid gap-x-6 text-sm sm:grid-cols-2">
            {perKategori.map(({ k, total }) => (
              <li key={k.id} className="flex justify-between border-b border-stone-100 py-1">
                <span>
                  {label(k.nama)} <span className="text-[11px] text-stone-400">{k.grup === "hpp" ? "HPP" : k.grup === "lain" ? "di luar laporan" : ""}</span>
                </span>
                <span className="tabular-nums">{formatRupiah(total)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ul className="space-y-2">
        {hariTampil.map((h) => {
          const items = perHari.get(h.tanggal) ?? [];
          const keluar = items.reduce((s, b) => s + b.jumlah, 0);
          const laci = items.filter((b) => b.sumber === "laci").reduce((s, b) => s + b.jumlah, 0);
          const terbuka = buka === h.tanggal;
          const kosong = !jual(h) && !items.length;
          return (
            <li key={h.tanggal} className={`rounded-2xl border bg-white ${kosong ? "border-stone-200 opacity-70" : "border-matur-200"}`}>
              <button onClick={() => setBuka(terbuka ? null : h.tanggal)} className="flex w-full items-center gap-3 p-4 text-left">
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{formatTanggal(h.tanggal)}</p>
                  <p className="text-xs text-stone-500">
                    {h.transaksi} transaksi · penjualan {formatRupiah(jual(h))} · pengeluaran {formatRupiah(keluar)}
                  </p>
                </div>
                {h.selisih !== null && (
                  <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${h.selisih === 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"}`}>
                    {h.selisih === 0 ? "kas pas" : `selisih ${formatRupiah(h.selisih)}`}
                  </span>
                )}
                <span className="text-stone-400">{terbuka ? "▴" : "▾"}</span>
              </button>
              {terbuka && (
                <div className="space-y-3 border-t px-4 pb-4 pt-3">
                  <div className="grid grid-cols-2 gap-1.5 text-xs sm:grid-cols-4">
                    {KANAL.map(([k, l]) => (
                      <div key={k} className="rounded-lg bg-stone-50 px-2 py-1.5">
                        <p className="text-stone-500">{l}</p>
                        <p className="font-semibold tabular-nums">{formatRupiah(Number(h[k] ?? 0))}</p>
                      </div>
                    ))}
                    <div className="rounded-lg bg-stone-50 px-2 py-1.5">
                      <p className="text-stone-500">Discount</p>
                      <p className="font-semibold tabular-nums">{formatRupiah(-h.diskon)}</p>
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center">
                      <p className="mr-auto text-sm font-semibold">Pengeluaran</p>
                      <button onClick={() => (setMsg(null), setForm({ tanggal: h.tanggal }))} className="rounded-lg border border-matur-300 px-2.5 py-1 text-xs font-semibold text-matur-700">
                        + Tambah
                      </button>
                    </div>
                    {items.length === 0 && <p className="text-xs text-stone-400">Tidak ada pengeluaran.</p>}
                    <ul className="divide-y text-sm">
                      {items.map((b) => (
                        <li key={b.id} className="flex items-center gap-2 py-1.5">
                          <div className="min-w-0 flex-1">
                            <p>{b.keterangan || label(kat[b.kategori_id]?.nama ?? "")}</p>
                            <p className="text-[11px] text-stone-500">
                              {label(kat[b.kategori_id]?.nama ?? "-")} · <span className={b.sumber === "laci" ? "text-amber-700" : "text-blue-700"}>{b.sumber === "laci" ? "laci" : "pusat"}</span>
                              {b.pengguna?.nama && ` · ${b.pengguna.nama}`}
                            </p>
                          </div>
                          <span className="tabular-nums">{formatRupiah(b.jumlah)}</span>
                          <button onClick={() => (setMsg(null), setForm({ tanggal: h.tanggal, item: b }))} className="rounded px-1.5 text-matur-700" title="Ubah">
                            ✏️
                          </button>
                          <button disabled={pending} onClick={() => confirm("Hapus pengeluaran ini?") && run(() => hapusPengeluaran(b.id))} className="rounded px-1.5 text-red-600" title="Hapus">
                            🗑
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-matur-50 p-2 text-xs sm:grid-cols-4">
                    <div>
                      <p className="text-stone-500">Penjualan tunai</p>
                      <p className="font-semibold tabular-nums">{formatRupiah(h.tunai)}</p>
                    </div>
                    <div>
                      <p className="text-stone-500">Keluar dari laci</p>
                      <p className="font-semibold tabular-nums">{formatRupiah(-laci)}</p>
                    </div>
                    <div>
                      <p className="text-stone-500">Setoran aktual</p>
                      <p className="font-semibold tabular-nums">{h.setoran === null ? "shift belum ditutup" : formatRupiah(h.setoran)}</p>
                    </div>
                    <div>
                      <p className="text-stone-500">Selisih</p>
                      <p className={`font-semibold tabular-nums ${h.selisih ? "text-red-600" : ""}`}>{h.selisih === null ? "-" : formatRupiah(h.selisih)}</p>
                    </div>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {form && (
        <Modal title={`${form.item ? "Ubah" : "Tambah"} pengeluaran · ${formatTanggal(form.tanggal)}`}>
          <FormPengeluaran
            kategori={kategori}
            pending={pending}
            awal={form.item ?? { kategori_id: "", jumlah: 0, keterangan: "", sumber: "laci" }}
            baru={!form.item}
            onBatal={() => setForm(null)}
            onSimpan={(d) =>
              run(() => (form.item ? ubahPengeluaran(form.item.id, { ...d, tanggal: form.tanggal }) : catatPengeluaran({ ...d, tanggal: form.tanggal }, outletId)), () => setForm(null))
            }
          />
          {msg?.error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{msg.error}</p>}
        </Modal>
      )}
    </div>
  );
}
