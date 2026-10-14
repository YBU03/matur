"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatRupiah } from "@/lib/format";
import { LABEL, LAPORAN, PRESET, rentangPreset, type Kolom } from "@/lib/laporan-pos";

type Row = Record<string, unknown>;
const angka = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });
const WARNA = ["#7c3aed", "#0ea5e9", "#f59e0b", "#10b981", "#ef4444", "#ec4899", "#14b8a6", "#8b5cf6"];

function tampil(v: unknown, k: Kolom): string {
  if (v === null || v === undefined || v === "") return "-";
  switch (k.tipe) {
    case "rp":
      return formatRupiah(Number(v));
    case "angka":
      return angka.format(Number(v));
    case "persen":
      return `${angka.format(Number(v))}%`;
    case "tgl":
      return new Date(String(v) + "T00:00:00").toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
    case "waktu":
      return new Date(String(v)).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
    case "label":
      return String(v)
        .split(" + ")
        .map((x) => LABEL[x] ?? x)
        .join(" + ");
    default:
      return k.k === "jam" ? `${String(v).padStart(2, "0")}:00` : String(v);
  }
}
const nilaiUrut = (v: unknown) => (typeof v === "number" ? v : v !== null && v !== "" && !isNaN(Number(v)) ? Number(v) : String(v ?? ""));

export function LaporanView(p: {
  jenis: string;
  outlets: { id: string; nama: string }[];
  bisaGudang: boolean;
  pilihan: string;
  namaTempat: string;
  dari: string;
  sampai: string;
  hariIni: string;
  bahan: { id: string; nama: string; satuan_pakai: string }[];
  bahanId: string | null;
  rows: Row[];
  err: string | null;
  sim: boolean;
  bolehSim: boolean;
}) {
  const lap = LAPORAN[p.jenis];
  const router = useRouter();
  const [dari, setDari] = useState(p.dari);
  const [sampai, setSampai] = useState(p.sampai);
  const [cari, setCari] = useState("");
  const [urut, setUrut] = useState<{ k: string; naik: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const buka = (q: Record<string, string | null>) => {
    const u = new URLSearchParams({ outlet: p.pilihan, dari: p.dari, sampai: p.sampai, ...(p.bahanId ? { bahan: p.bahanId } : {}), ...(p.sim ? { sim: "1" } : {}) });
    for (const [k, v] of Object.entries(q)) {
      if (v) u.set(k, v);
      else u.delete(k);
    }
    router.push(`/laporan-pos/${p.jenis}?${u}`);
  };
  const preset = (k: string) => {
    const [a, b] = rentangPreset(k, p.hariIni);
    buka({ dari: a, sampai: b });
  };
  const presetAktif = PRESET.find(([k]) => {
    const [a, b] = rentangPreset(k, p.hariIni);
    return lap.tanggal === "per" ? b === p.sampai : a === p.dari && b === p.sampai;
  })?.[0];

  const baris = useMemo(() => {
    const q = cari.trim().toLowerCase();
    let r = q ? p.rows.filter((x) => lap.kolom.some((k) => tampil(x[k.k], k).toLowerCase().includes(q))) : p.rows;
    if (urut) r = [...r].sort((a, b) => {
      const x = nilaiUrut(a[urut.k]), y = nilaiUrut(b[urut.k]);
      return (x < y ? -1 : x > y ? 1 : 0) * (urut.naik ? 1 : -1);
    });
    return r;
  }, [p.rows, cari, urut, lap.kolom]);
  const total = (k: Kolom) => baris.reduce((s, x) => s + (Number(x[k.k]) || 0), 0);
  const adaTotal = !lap.kartu && lap.kolom.some((k) => k.total && (k.tipe === "rp" || k.tipe === "angka"));
  const periode = lap.tanggal === "per" ? `per ${tampil(p.sampai, { k: "", label: "", tipe: "tgl" })}` : lap.tanggal === "rentang" ? `${tampil(p.dari, { k: "", label: "", tipe: "tgl" })} – ${tampil(p.sampai, { k: "", label: "", tipe: "tgl" })}` : "";

  const unduh = async () => {
    setBusy(true);
    try {
      const { Workbook } = (await import("exceljs")).default;
      const wb = new Workbook();
      const ws = wb.addWorksheet(lap.judul.slice(0, 31));
      ws.addRow([lap.judul]).font = { bold: true, size: 14 };
      ws.addRow([`${p.namaTempat}${periode ? " · " + periode : ""}${p.sim ? " · SIMULASI" : ""}`]);
      ws.addRow([]);
      const kol = lap.kartu ? [{ k: "metrik", label: "Metrik" } as Kolom, { k: "nilai", label: "Nilai" } as Kolom] : lap.kolom;
      const h = ws.addRow(kol.map((k) => k.label));
      h.font = { bold: true };
      h.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC5E0B3" } }));
      const isi = (v: unknown, k: Kolom) => (v === null || v === undefined ? null : k.tipe === "rp" || k.tipe === "angka" || k.tipe === "persen" ? Number(v) : k.tipe === "tgl" ? new Date(String(v) + "T00:00:00Z") : k.tipe === "waktu" ? tampil(v, k) : tampil(v, k));
      if (lap.kartu) for (const k of lap.kolom) ws.addRow([k.label, Number(baris[0]?.[k.k] ?? 0)]);
      else for (const r of baris) ws.addRow(kol.map((k) => isi(r[k.k], k)));
      if (adaTotal) {
        const t = ws.addRow(kol.map((k, i) => (i === 0 ? "Total" : k.total && (k.tipe === "rp" || k.tipe === "angka") ? total(k) : null)));
        t.font = { bold: true };
      }
      kol.forEach((k, i) => {
        const c = ws.getColumn(i + 1);
        c.width = k.tipe === "rp" ? 16 : k.k === "item" || k.k === "keterangan" ? 40 : 14;
        if (k.tipe === "rp" || lap.kartu) c.numFmt = '"Rp" #,##0;("Rp" #,##0);"Rp -"';
        if (k.tipe === "tgl") c.numFmt = "dd mmm yyyy";
      });
      const blob = new Blob([await wb.xlsx.writeBuffer()], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${lap.judul} ${p.namaTempat} ${p.dari}_${p.sampai}.xlsx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-start gap-2">
        <div className="mr-auto">
          <Link href={`/laporan-pos?tab=${lap.tab}`} className="text-sm text-matur-700">
            ← Laporan
          </Link>
          <h1 className="text-2xl font-bold">{lap.judul}</h1>
          <p className="text-sm text-stone-500">
            {p.namaTempat} {periode && `· ${periode}`} {p.sim && <b className="text-violet-700">· SIMULASI</b>}
          </p>
        </div>
        <button disabled={busy || !p.rows.length} onClick={unduh} className="rounded-xl border border-green-600 bg-white px-3 py-2 text-sm font-semibold text-green-700 disabled:opacity-40">
          {busy ? "Menyiapkan…" : "⬇ Excel"}
        </button>
        <button onClick={() => window.print()} className="rounded-xl border px-3 py-2 text-sm font-semibold print:hidden">
          🖨 Cetak
        </button>
      </div>

      <section className="space-y-3 rounded-2xl border border-matur-200 bg-white p-3 print:hidden">
        <div className="flex flex-wrap items-end gap-2">
          {(p.outlets.length > 0 || p.bisaGudang) && (
            <label className="text-xs font-semibold text-stone-600">
              {lap.lingkup === "outlet" ? "Outlet" : "Lokasi"}
              <select value={p.pilihan} onChange={(e) => buka({ outlet: e.target.value })} className="mt-1 block rounded-lg border px-3 py-2 text-sm font-normal">
                {p.bisaGudang && <option value="gudang">🏭 Gudang Pusat</option>}
                {p.outlets.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nama}
                  </option>
                ))}
              </select>
            </label>
          )}
          {lap.bahan && (
            <label className="text-xs font-semibold text-stone-600">
              Bahan {lap.bahan === "wajib" && "*"}
              <select value={p.bahanId ?? ""} onChange={(e) => buka({ bahan: e.target.value || null })} className="mt-1 block max-w-64 rounded-lg border px-3 py-2 text-sm font-normal">
                <option value="">{lap.bahan === "wajib" ? "— pilih bahan —" : "Semua bahan"}</option>
                {p.bahan.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nama} ({b.satuan_pakai})
                  </option>
                ))}
              </select>
            </label>
          )}
          {lap.tanggal !== "tidak" && (
            <>
              {lap.tanggal === "rentang" && (
                <label className="text-xs font-semibold text-stone-600">
                  Dari
                  <input type="date" value={dari} max={sampai} onChange={(e) => setDari(e.target.value)} className="mt-1 block rounded-lg border px-3 py-2 text-sm font-normal" />
                </label>
              )}
              <label className="text-xs font-semibold text-stone-600">
                {lap.tanggal === "per" ? "Per tanggal" : "Sampai"}
                <input type="date" value={sampai} min={lap.tanggal === "rentang" ? dari : undefined} onChange={(e) => setSampai(e.target.value)} className="mt-1 block rounded-lg border px-3 py-2 text-sm font-normal" />
              </label>
              <button onClick={() => buka({ dari: lap.tanggal === "per" ? sampai : dari, sampai })} className="rounded-lg bg-kopi-900 px-4 py-2 text-sm font-semibold text-white">
                Terapkan
              </button>
            </>
          )}
          {p.bolehSim && (
            <label className="ml-auto flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={p.sim} onChange={(e) => buka({ sim: e.target.checked ? "1" : null })} className="accent-violet-600" />
              Simulasi
            </label>
          )}
        </div>
        {lap.tanggal !== "tidak" && (
          <div className="flex flex-wrap gap-1.5">
            {PRESET.filter(([k]) => lap.tanggal === "rentang" || ["hari_ini", "kemarin"].includes(k)).map(([k, l]) => (
              <button key={k} onClick={() => preset(k)} className={`rounded-full px-3 py-1 text-xs font-semibold ${presetAktif === k ? "bg-violet-600 text-white" : "bg-violet-50 text-violet-700 hover:bg-violet-100"}`}>
                {l}
              </button>
            ))}
            {lap.tanggal === "per" &&
              [["akhir_bulan_lalu", "Akhir bulan lalu"]].map(([k, l]) => (
                <button key={k} onClick={() => buka({ sampai: rentangPreset("bulan_lalu", p.hariIni)[1], dari: rentangPreset("bulan_lalu", p.hariIni)[1] })} className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-100">
                  {l}
                </button>
              ))}
          </div>
        )}
      </section>

      {p.err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{p.err}</p>}
      {lap.bahan === "wajib" && !p.bahanId && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Pilih bahan untuk melihat kartu stoknya.</p>}

      {lap.kartu && baris[0] && (
        <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {lap.kolom.map((k, i) => (
            <div key={k.k} className="rounded-2xl border border-matur-200 bg-white p-3">
              <p className="text-xs text-stone-500">{k.label}</p>
              <p className="text-lg font-bold tabular-nums" style={{ color: i < 8 ? WARNA[i % WARNA.length] : undefined }}>
                {tampil(baris[0][k.k], k)}
              </p>
            </div>
          ))}
        </section>
      )}

      {lap.grafik && baris.length > 0 && (
        <section className="h-64 rounded-2xl border border-matur-200 bg-white p-3 print:hidden">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={baris.map((r) => ({ x: tampil(r[lap.grafik!.x], lap.kolom.find((k) => k.k === lap.grafik!.x)!), y: Number(r[lap.grafik!.y]) || 0 }))}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="x" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}jt` : v >= 1e3 ? `${Math.round(v / 1e3)}rb` : String(v))} width={48} />
              <Tooltip formatter={(v) => formatRupiah(Number(v))} />
              <Bar dataKey="y" fill="#7c3aed" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}

      {!lap.kartu && (
        <section className="rounded-2xl border border-matur-200 bg-white p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2 print:hidden">
            <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="🔍 Cari di laporan…" className="min-w-48 flex-1 rounded-lg border px-3 py-2 text-sm" />
            <span className="text-xs text-stone-500">{baris.length} baris</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#C5E0B3]/40 text-left text-xs text-stone-600">
                <tr>
                  {lap.kolom.map((k) => (
                    <th
                      key={k.k}
                      onClick={() => setUrut(urut?.k === k.k ? { k: k.k, naik: !urut.naik } : { k: k.k, naik: !(k.tipe === "rp" || k.tipe === "angka") })}
                      className={`cursor-pointer whitespace-nowrap px-2 py-2 font-semibold ${k.tipe === "rp" || k.tipe === "angka" || k.tipe === "persen" ? "text-right" : ""}`}
                    >
                      {k.label}
                      {urut?.k === k.k ? (urut.naik ? " ▲" : " ▼") : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {baris.map((r, i) => (
                  <tr key={i} className="border-t border-stone-100 hover:bg-matur-50/50">
                    {lap.kolom.map((k) => (
                      <td key={k.k} className={`px-2 py-1.5 ${k.tipe === "rp" || k.tipe === "angka" || k.tipe === "persen" ? "text-right tabular-nums" : ""} ${k.k === "item" || k.k === "keterangan" ? "min-w-48" : "whitespace-nowrap"} ${k.k === "status" && (r[k.k] === "habis" || r[k.k] === "void") ? "font-semibold text-red-600" : k.k === "status" && r[k.k] === "menipis" ? "font-semibold text-amber-600" : ""}`}>
                        {tampil(r[k.k], k)}
                      </td>
                    ))}
                  </tr>
                ))}
                {baris.length === 0 && (
                  <tr>
                    <td colSpan={lap.kolom.length} className="py-8 text-center text-stone-500">
                      Tidak ada data pada periode ini.
                    </td>
                  </tr>
                )}
              </tbody>
              {adaTotal && baris.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-stone-300 bg-stone-50 font-bold">
                    {lap.kolom.map((k, i) => (
                      <td key={k.k} className={`px-2 py-2 ${k.tipe === "rp" || k.tipe === "angka" ? "text-right tabular-nums" : ""}`}>
                        {i === 0 ? "Total" : k.total && (k.tipe === "rp" || k.tipe === "angka") ? tampil(total(k), k) : ""}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
