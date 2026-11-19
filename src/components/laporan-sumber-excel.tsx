"use client";

import Link from "next/link";
import { useState } from "react";
import type { SumberExcel } from "@/lib/laporan-sumber-excel";
import { judulPeriodeSumber } from "@/lib/laporan-sumber-excel";

export function LaporanSumberExcel({
  sumber: s,
  outletId,
}: {
  sumber: SumberExcel;
  outletId: string;
}) {
  const [sheet, setSheet] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selected = s.lembar[sheet] ?? s.lembar[0];
  const download = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };
  const pdf = async () => {
    setBusy(true);
    setError("");
    try {
      const { pdfSumberExcel } = await import("@/lib/laporan-sumber-excel");
      download(
        (await pdfSumberExcel(s)).output("blob"),
        `Laporan-Kominot-${s.periode}-Lengkap.pdf`,
      );
    } catch {
      setError("PDF belum berhasil dibuat. Coba lagi.");
    } finally {
      setBusy(false);
    }
  };
  const excel = () => {
    try {
      const bytes = Uint8Array.from(atob(s.xlsx_base64), (c) =>
        c.charCodeAt(0),
      );
      download(
        new Blob([bytes], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        s.nama_file,
      );
    } catch {
      setError("Salinan Excel belum berhasil diunduh.");
    }
  };
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <Link
        href={`/laporan?outlet=${outletId}`}
        className="text-sm font-semibold text-matur-700"
      >
        ← Semua laporan
      </Link>
      <header className="space-y-2 rounded-2xl border border-matur-200 bg-white p-5">
        <h1 className="text-xl font-bold">
          Laporan {judulPeriodeSumber(s)} · {s.outlet_tujuan}
        </h1>
        <p className="text-sm">
          Impor Excel lengkap · sumber: {s.nama_sumber} · internal, belum
          diterbitkan ke Mitra.
        </p>
        <p className="text-sm text-stone-600">
          Nilai asli dan hasil rumus disimpan tanpa pembulatan tambahan.
          Tampilan mengikuti format Excel. Klik rincian baris untuk melihat
          nilai presisi dan rumus sumber.
        </p>
        {s.koreksi.map((k) => (
          <p key={`${k.lembar}-${k.sel}`} className="text-sm text-amber-900">
            Koreksi pencatatan: {k.lembar}!{k.sel}, {k.asli} → {k.hasil}.
            Salinan Excel asli tetap dipertahankan.
          </p>
        ))}
        <div className="flex flex-wrap gap-2 pt-2">
          <button
            disabled={busy}
            onClick={pdf}
            className="rounded-lg bg-matur-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Menyiapkan PDF…" : "Unduh PDF lengkap"}
          </button>
          <button
            onClick={excel}
            className="rounded-lg border px-4 py-2 font-semibold"
          >
            Unduh Excel sumber
          </button>
          <Link
            href={`/catatan-harian?outlet=${outletId}&bulan=${s.periode}`}
            className="rounded-lg border px-4 py-2"
          >
            Catatan Harian
          </Link>
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
      </header>
      <div className="flex flex-wrap gap-2" aria-label="Lembar sumber">
        {s.lembar.map((l, i) => (
          <button
            key={l.nama}
            onClick={() => setSheet(i)}
            aria-pressed={sheet === i}
            className={`rounded-lg border px-4 py-2 font-semibold ${sheet === i ? "bg-kopi-900 text-white" : "bg-white"}`}
          >
            {l.nama}
          </button>
        ))}
      </div>
      <section className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-sm">
          <caption className="p-3 text-left font-semibold">
            {selected.nama} · seluruh baris berisi dari sumber
          </caption>
          <thead className="bg-matur-50 text-left">
            <tr>
              <th className="p-3">Baris</th>
              <th className="p-3">Keterangan / teks sumber</th>
              <th className="p-3">Nilai sumber</th>
            </tr>
          </thead>
          <tbody>
            {selected.baris.map((row) => (
              <tr key={row.nomor} className="border-t align-top">
                <td className="p-3 text-stone-500">{row.nomor}</td>
                <td className="min-w-64 p-3">
                  {row.sel
                    .filter((c) => typeof c.nilai !== "number")
                    .map((c) => (
                      <p key={c.alamat} className="whitespace-pre-wrap">
                        <span className="mr-2 text-xs text-stone-400">
                          {c.alamat}
                        </span>
                        {c.teks}
                      </p>
                    ))}
                </td>
                <td className="min-w-56 p-3">
                  {row.sel
                    .filter((c) => typeof c.nilai === "number")
                    .map((c) => (
                      <div
                        key={c.alamat}
                        className="flex justify-between gap-4 tabular-nums"
                      >
                        <span className="text-xs text-stone-400">
                          {c.alamat}
                        </span>
                        <span>{c.teks}</span>
                      </div>
                    ))}
                  <details className="mt-2 text-xs text-stone-500">
                    <summary className="cursor-pointer">
                      Nilai presisi & rumus
                    </summary>
                    {row.sel.map((c) => (
                      <p key={c.alamat} className="break-all py-1">
                        {c.alamat}: {String(c.nilai ?? "")}
                        {c.rumus ? ` · =${c.rumus}` : ""}
                      </p>
                    ))}
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <aside className="space-y-1 text-xs text-stone-500">
        {s.catatan.map((t) => (
          <p key={t}>{t}</p>
        ))}
        <p className="break-all">SHA-256 sumber: {s.sha256}</p>
      </aside>
    </div>
  );
}
