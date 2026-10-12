"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Modal } from "@/components/confirm-edit";
import { StatTile } from "@/components/charts";
import { rupiah } from "@/lib/chart-utils";
import { KATEGORI_BAHAN } from "@/lib/master";
import { koreksiStok } from "@/lib/stok-actions";

export type BahanStok = {
  id: string;
  nama: string;
  kategori: string;
  satuan_beli: string;
  satuan_pakai: string;
  konversi: number;
  kemasan: string | null;
  harga_beli: number;
  harga_pokok: number;
  stok_min: number;
  catatan: string | null;
  jumlah: number; // satuan pakai
  updated_at: string | null;
};

const nf = (n: number, d = 2) => n.toLocaleString("id-ID", { maximumFractionDigits: d });
// nilai = jumlah kemasan × harga beli per kemasan (sama dengan daftar belanja)
const nilai = (b: BahanStok) => (b.jumlah / b.konversi) * b.harga_beli;
const status = (b: BahanStok) => (b.jumlah <= 0 ? "habis" : b.jumlah < b.stok_min ? "menipis" : "aman");
const BADGE = {
  aman: "bg-green-100 text-green-800",
  menipis: "bg-amber-100 text-amber-800",
  habis: "bg-red-100 text-red-700",
} as const;

export function StokView({ rows, canEdit }: { rows: BahanStok[]; canEdit: boolean }) {
  const [cari, setCari] = useState("");
  const [kat, setKat] = useState<string | null>(null);
  const [hanya, setHanya] = useState<"" | "menipis" | "cek">("");
  const [edit, setEdit] = useState<BahanStok | null>(null);

  const shown = useMemo(
    () =>
      rows.filter(
        (b) =>
          (!kat || b.kategori === kat) &&
          b.nama.toLowerCase().includes(cari.toLowerCase()) &&
          (hanya === "" || (hanya === "menipis" ? status(b) !== "aman" : !!b.catatan)),
      ),
    [rows, kat, cari, hanya],
  );
  const groups = [...KATEGORI_BAHAN, ...new Set(rows.map((r) => r.kategori).filter((k) => !KATEGORI_BAHAN.includes(k)))]
    .map((k) => ({ k, items: shown.filter((b) => b.kategori === k) }))
    .filter((g) => g.items.length);
  const total = rows.reduce((s, b) => s + nilai(b), 0);
  const menipis = rows.filter((b) => status(b) !== "aman").length;
  const cek = rows.filter((b) => b.catatan).length;
  const chip = (on: boolean) => `rounded-lg px-3 py-1.5 text-sm font-medium ${on ? "bg-kopi-700 text-white" : "border border-matur-200 bg-white text-kopi-700"}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-2xl font-bold">Bahan Baku & Stok Gudang</h1>
        <button onClick={() => exportExcel(rows)} className="rounded-xl border border-green-600 bg-white px-3 py-2 text-sm font-semibold text-green-700">⬇ Export Excel</button>
        {canEdit && (
          <Link href="/master/bahan" className="rounded-xl bg-matur-500 px-3 py-2 text-sm font-semibold text-white">+ Tambah / Ubah Bahan</Link>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Jenis bahan" value={String(rows.length)} />
        <StatTile label="Nilai persediaan gudang" value={rupiah(total)} sub="jumlah kemasan × harga beli" />
        <button onClick={() => setHanya(hanya === "menipis" ? "" : "menipis")} className="text-left">
          <StatTile label="Stok menipis / habis" value={String(menipis)} sub="ketuk untuk menyaring" tone={menipis ? "warn" : undefined} />
        </button>
        <button onClick={() => setHanya(hanya === "cek" ? "" : "cek")} className="text-left">
          <StatTile label="Perlu dicek" value={String(cek)} sub="data kemasan/harga belum pasti" tone={cek ? "warn" : undefined} />
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari bahan…" className="min-w-40 flex-1 rounded-xl border border-matur-200 bg-white px-3 py-2" />
        <button onClick={() => setKat(null)} className={chip(!kat)}>Semua</button>
        {KATEGORI_BAHAN.filter((k) => rows.some((r) => r.kategori === k)).map((k) => (
          <button key={k} onClick={() => setKat(k)} className={chip(kat === k)}>{k}</button>
        ))}
      </div>
      {hanya && (
        <p className="text-sm text-stone-600">
          Menampilkan: <b>{hanya === "menipis" ? "stok menipis/habis" : "perlu dicek"}</b> ·{" "}
          <button onClick={() => setHanya("")} className="text-matur-700 underline">tampilkan semua</button>
        </p>
      )}

      {groups.length === 0 && <p className="py-10 text-center text-stone-400">Tidak ada bahan yang cocok.</p>}
      {groups.map((g) => (
        <section key={g.k} className="overflow-hidden rounded-2xl border border-matur-200 bg-white">
          <h2 className="flex justify-between bg-matur-50 px-4 py-2 font-bold">
            <span>{g.k} <span className="font-normal text-stone-500">· {g.items.length}</span></span>
            <span className="tabular-nums">{rupiah(g.items.reduce((s, b) => s + nilai(b), 0))}</span>
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] table-fixed text-sm">
              <colgroup>
                <col className="w-[34%]" />
                <col className="w-[12%]" />
                <col className="w-[14%]" />
                <col className="w-[14%]" />
                <col className="w-[12%]" />
                <col className="w-[7%]" />
                {canEdit && <col className="w-[10%]" />}
              </colgroup>
              <thead className="text-left text-xs text-stone-500">
                <tr>
                  <th className="px-3 py-2">Bahan</th>
                  <th className="px-3 text-right">Stok</th>
                  <th className="px-3 text-right">Harga beli</th>
                  <th className="px-3 text-right">HPP / satuan pakai</th>
                  <th className="px-3 text-right">Nilai</th>
                  <th className="px-3">Status</th>
                  {canEdit && <th className="px-3" />}
                </tr>
              </thead>
              <tbody>
                {g.items.map((b) => {
                  const st = status(b);
                  return (
                    <tr key={b.id} className="border-t border-stone-100 align-top">
                      <td className="px-3 py-2">
                        <p className="font-medium">{b.nama}</p>
                        <p className="text-xs text-stone-500">
                          {b.satuan_beli}
                          {b.kemasan && ` · ${b.kemasan}`}
                          {b.konversi !== 1 && ` · 1 ${b.satuan_beli} = ${nf(b.konversi)} ${b.satuan_pakai}`}
                        </p>
                        {b.catatan && <p className="mt-0.5 text-xs text-amber-700">⚠️ {b.catatan}</p>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">
                        <p className="font-semibold tabular-nums">{nf(b.jumlah / b.konversi)} {b.satuan_beli}</p>
                        {b.konversi !== 1 && <p className="text-xs text-stone-500 tabular-nums">{nf(b.jumlah, 0)} {b.satuan_pakai}</p>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{rupiah(b.harga_beli)}<span className="text-xs text-stone-500">/{b.satuan_beli}</span></td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">Rp {nf(b.harga_pokok)}<span className="text-xs text-stone-500">/{b.satuan_pakai}</span></td>
                      <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums">{rupiah(nilai(b))}</td>
                      <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs ${BADGE[st]}`}>{st}</span></td>
                      {canEdit && (
                        <td className="whitespace-nowrap px-3 py-2 text-right">
                          <button onClick={() => setEdit(b)} className="text-matur-700 hover:underline">Koreksi stok</button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      <p className="text-xs text-stone-500">Pembelian ke supplier, kiriman ke outlet, dan stok opname akan menambah/mengurangi stok otomatis di tahap berikutnya.</p>
      {edit && <KoreksiDialog b={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function KoreksiDialog({ b, onClose }: { b: BahanStok; onClose: () => void }) {
  const router = useRouter();
  const lama = b.jumlah / b.konversi;
  const [v, setV] = useState(String(Math.round(lama * 1000) / 1000).replace(".", ","));
  const [konfirmasi, setKonfirmasi] = useState(false);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const baru = Number(v.replace(",", "."));
  return (
    <Modal title={`Koreksi stok · ${b.nama}`}>
      {!konfirmasi ? (
        <label className="block text-sm font-medium">
          Stok fisik sekarang ({b.satuan_beli})
          <input value={v} onChange={(e) => setV(e.target.value)} inputMode="decimal" className="mt-1 w-full rounded-lg border px-3 py-2 text-lg" />
          {b.konversi !== 1 && Number.isFinite(baru) && <span className="mt-1 block text-xs text-stone-500">= {nf(baru * b.konversi, 0)} {b.satuan_pakai}</span>}
        </label>
      ) : (
        <p className="text-sm">
          Stok <b>{b.nama}</b>: <span className="text-red-600 line-through">{nf(lama)} {b.satuan_beli}</span> →{" "}
          <span className="font-semibold text-green-700">{nf(baru)} {b.satuan_beli}</span>
        </p>
      )}
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={konfirmasi ? () => setKonfirmasi(false) : onClose} className="rounded-lg border px-4 py-2 text-sm">{konfirmasi ? "Periksa lagi" : "Batal"}</button>
        <button
          disabled={pending || !Number.isFinite(baru) || baru < 0}
          onClick={() =>
            konfirmasi
              ? start(async () => {
                  const r = await koreksiStok(b.id, baru);
                  if (r.error) return setErr(r.error);
                  router.refresh();
                  onClose();
                })
              : setKonfirmasi(true)
          }
          className="rounded-lg bg-matur-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {konfirmasi ? (pending ? "Menyimpan…" : "Ya, sudah benar") : "Simpan"}
        </button>
      </div>
    </Modal>
  );
}

async function exportExcel(rows: BahanStok[]) {
  const { Workbook } = (await import("exceljs")).default;
  const wb = new Workbook();
  const ws = wb.addWorksheet("Stok Gudang");
  ws.addRow([`Bahan Baku & Stok Gudang · ${new Date().toLocaleDateString("id-ID", { dateStyle: "long" })}`]).font = { bold: true, size: 13 };
  ws.addRow([]);
  const h = ws.addRow(["Kategori", "Bahan", "Satuan Beli", "Kemasan", "Stok (satuan beli)", "Stok (satuan pakai)", "Satuan Pakai", "Harga Beli", "HPP / Satuan Pakai", "Nilai", "Catatan"]);
  h.font = { bold: true };
  h.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFDE85" } }));
  for (const b of rows)
    ws.addRow([b.kategori, b.nama, b.satuan_beli, b.kemasan, b.jumlah / b.konversi, b.jumlah, b.satuan_pakai, b.harga_beli, b.harga_pokok, Math.round(nilai(b)), b.catatan]);
  ws.addRow([]);
  ws.addRow(["GRAND TOTAL", null, null, null, null, null, null, null, null, Math.round(rows.reduce((s, b) => s + nilai(b), 0))]).font = { bold: true };
  [14, 30, 11, 16, 12, 12, 10, 14, 14, 15, 40].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  [8, 10].forEach((c) => (ws.getColumn(c).numFmt = '"Rp" #,##0'));
  ws.getColumn(9).numFmt = '"Rp" #,##0.00';
  const blob = new Blob([await wb.xlsx.writeBuffer()], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "Stok Gudang.xlsx";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
