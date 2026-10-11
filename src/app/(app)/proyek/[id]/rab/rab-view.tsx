"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Modal } from "@/components/confirm-edit";
import { formatRupiah } from "@/lib/format";
import { importRab, type Result } from "@/lib/proyek-actions";
import { exportExcel, exportPdf, groupRab, parseWorkbook, type RabRow } from "@/lib/rab-excel";

type Item = RabRow & { id: string };
const STATUS: Record<string, string> = {
  rencana: "bg-stone-100 text-stone-600",
  dibeli: "bg-amber-100 text-amber-800",
  terpasang: "bg-green-100 text-green-800",
};

export function RabView({ proyek, items, admin }: { proyek: { id: string; nama: string; budget: number; outlet: string }; items: Item[]; admin: boolean }) {
  const groups = groupRab(items);
  const total = groups.reduce((s, g) => s + g.estimasi, 0);
  const realisasi = groups.reduce((s, g) => s + g.realisasi, 0);
  const judul = `Rincian Keperluan ${proyek.nama}`;
  const [busy, setBusy] = useState("");

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try {
      await fn();
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <Link href={`/proyek/${proyek.id}`} className="text-sm text-matur-700">← {proyek.nama}</Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="mr-auto text-2xl font-bold">Rincian Keperluan</h1>
          <button disabled={!!busy || !items.length} onClick={() => run("xlsx", () => exportExcel(judul, items))} className="rounded-xl border border-green-600 bg-white px-3 py-2 text-sm font-semibold text-green-700 disabled:opacity-50">
            {busy === "xlsx" ? "Menyiapkan…" : "⬇ Export Excel"}
          </button>
          <button
            disabled={!!busy || !items.length}
            onClick={() => run("pdf", () => exportPdf(judul, `${proyek.outlet} · dicetak ${new Date().toLocaleDateString("id-ID", { dateStyle: "long" })}`, items))}
            className="rounded-xl border border-red-600 bg-white px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"
          >
            {busy === "pdf" ? "Menyiapkan…" : "⬇ Export PDF"}
          </button>
          {admin && <ImportButton proyekId={proyek.id} adaData={items.length > 0} />}
          {admin && (
            <Link href={`/master/item_rab?proyek_id=${proyek.id}`} className="rounded-xl bg-matur-500 px-3 py-2 text-sm font-semibold text-white">
              + Tambah / Ubah Item
            </Link>
          )}
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {groups.map((g) => (
          <a key={g.kelompok} href={`#${g.kelompok}`} className="rounded-2xl border border-matur-200 bg-white p-4">
            <p className="text-xs text-stone-500">{g.kelompok} · {g.items.length} item</p>
            <p className="text-lg font-bold">{formatRupiah(g.estimasi)}</p>
            {g.realisasi > 0 && <p className="text-xs text-stone-500">Realisasi {formatRupiah(g.realisasi)}</p>}
          </a>
        ))}
        <div className="rounded-2xl bg-kopi-700 p-4 text-white">
          <p className="text-xs text-white/70">Grand Total</p>
          <p className="text-lg font-bold">{formatRupiah(total)}</p>
          <p className="text-xs text-white/70">
            Budget {formatRupiah(proyek.budget)}{realisasi > 0 && ` · Realisasi ${formatRupiah(realisasi)}`}
          </p>
        </div>
      </section>
      {proyek.budget > 0 && total > proyek.budget && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">Total keperluan melebihi estimasi budget proyek sebesar {formatRupiah(total - proyek.budget)}.</p>
      )}

      {items.length === 0 && (
        <p className="rounded-2xl border border-dashed border-matur-300 bg-white py-10 text-center text-stone-500">
          Belum ada rincian. {admin ? "Import file Excel atau tambah item satu per satu." : ""}
        </p>
      )}

      {groups.map((g) => (
        <section key={g.kelompok} id={g.kelompok} className="overflow-hidden rounded-2xl border border-matur-200 bg-white">
          <h2 className="flex justify-between bg-matur-50 px-4 py-2 font-bold">
            <span>{g.kelompok}</span>
            <span className="tabular-nums">{formatRupiah(g.estimasi)}</span>
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-stone-500">
                <tr>
                  <th className="px-3 py-2">Nama Barang</th>
                  <th className="px-3">Spesifikasi</th>
                  <th className="px-3 text-right">Jumlah</th>
                  <th className="px-3 text-right">Harga Satuan</th>
                  <th className="px-3 text-right">Total</th>
                  <th className="px-3 text-right">Realisasi</th>
                  <th className="px-3">Status</th>
                  <th className="px-3">Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {g.items.map((i, idx) => (
                  <Rows key={i.id} item={i} showBagian={i.bagian !== null && i.bagian !== g.items[idx - 1]?.bagian} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

function Rows({ item: i, showBagian }: { item: Item; showBagian: boolean }) {
  return (
    <>
      {showBagian && (
        <tr className="border-t bg-stone-50">
          <td colSpan={8} className="px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-kopi-700">{i.bagian}</td>
        </tr>
      )}
      <tr className="border-t border-stone-100">
        <td className="px-3 py-2 font-medium">{i.nama}</td>
        <td className="px-3 text-stone-600">{i.spesifikasi ?? ""}</td>
        <td className="whitespace-nowrap px-3 text-right">{i.qty} {i.satuan ?? ""}</td>
        <td className="whitespace-nowrap px-3 text-right tabular-nums">{i.harga_satuan ? formatRupiah(i.harga_satuan) : ""}</td>
        <td className="whitespace-nowrap px-3 text-right font-semibold tabular-nums">{formatRupiah(i.harga_estimasi)}</td>
        <td className="whitespace-nowrap px-3 text-right tabular-nums">{i.harga_realisasi ? formatRupiah(i.harga_realisasi) : ""}</td>
        <td className="px-3"><span className={`rounded-full px-2 py-0.5 text-xs ${STATUS[i.status]}`}>{i.status}</span></td>
        <td className="px-3 text-xs text-stone-500">{i.keterangan ?? ""}</td>
      </tr>
    </>
  );
}

function ImportButton({ proyekId, adaData }: { proyekId: string; adaData: boolean }) {
  const router = useRouter();
  const [preview, setPreview] = useState<{ rows: RabRow[]; notes: string[]; file: string } | null>(null);
  const [ganti, setGanti] = useState(false);
  const [res, setRes] = useState<Result | null>(null);
  const [pending, start] = useTransition();

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setRes(null);
    try {
      const parsed = await parseWorkbook(await f.arrayBuffer());
      setPreview({ ...parsed, file: f.name });
    } catch {
      setRes({ error: "File tidak bisa dibaca. Pastikan formatnya .xlsx." });
    }
  };
  const groups = preview ? groupRab(preview.rows) : [];

  return (
    <>
      <label className="cursor-pointer rounded-xl border border-matur-500 bg-white px-3 py-2 text-sm font-semibold text-matur-700">
        ⬆ Import Excel
        <input type="file" accept=".xlsx" className="hidden" onChange={(e) => (pick(e.target.files?.[0]), (e.target.value = ""))} />
      </label>
      {res?.error && !preview && <span className="text-sm text-red-600">{res.error}</span>}
      {preview && (
        <Modal title={`Pratinjau import · ${preview.file}`}>
          <div className="max-h-[60vh] space-y-3 overflow-y-auto text-sm">
            <p>{preview.rows.length} item terbaca:</p>
            <table className="w-full">
              <tbody>
                {groups.map((g) => (
                  <tr key={g.kelompok} className="border-t">
                    <td className="py-1">{g.kelompok}</td>
                    <td className="text-right">{g.items.length} item</td>
                    <td className="text-right font-semibold tabular-nums">{formatRupiah(g.estimasi)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 font-bold">
                  <td className="py-1">Grand Total</td>
                  <td />
                  <td className="text-right tabular-nums">{formatRupiah(groups.reduce((s, g) => s + g.estimasi, 0))}</td>
                </tr>
              </tbody>
            </table>
            {preview.notes.map((n) => (
              <p key={n} className={`rounded-lg px-3 py-2 ${n.startsWith("⚠️") ? "bg-amber-50 text-amber-800" : "bg-stone-50 text-stone-600"}`}>{n}</p>
            ))}
            {adaData && (
              <label className="flex items-start gap-2 rounded-lg border p-3">
                <input type="checkbox" checked={ganti} onChange={(e) => setGanti(e.target.checked)} className="mt-0.5 accent-matur-500" />
                <span>Ganti semua rincian yang sudah ada (data lama dipindah ke tempat sampah). Jika tidak dicentang, item baru ditambahkan.</span>
              </label>
            )}
            {res && <p className={`rounded-lg px-3 py-2 ${res.error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>{res.error ?? res.ok}</p>}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setPreview(null)} className="rounded-lg border px-4 py-2 text-sm">Batal</button>
            <button
              disabled={pending || preview.rows.length === 0}
              onClick={() =>
                start(async () => {
                  const r = await importRab(proyekId, preview.rows, ganti);
                  setRes(r);
                  if (!r.error) {
                    router.refresh();
                    setTimeout(() => setPreview(null), 1000);
                  }
                })
              }
              className="rounded-lg bg-matur-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {pending ? "Menyimpan…" : `Simpan ${preview.rows.length} item`}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
