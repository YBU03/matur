"use client";

import { useState } from "react";
import { namaBulan, type Laporan, type Perusahaan } from "@/lib/laporan";
import { type Visual } from "./visual";

// Unduh laporan resmi sebagai PDF (A4), urutan bagian sama dengan laporan manual
export function UnduhPdf({
  l,
  pt,
  visual: v,
  internal = false,
}: {
  l: Laporan;
  pt: Perusahaan;
  visual: Visual;
  internal?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const { buatLaporanKeuanganPdf } = await import(
        "@/lib/laporan-keuangan-pdf"
      );
      const doc = await buatLaporanKeuanganPdf({ l, pt, visual: v, internal });
      const bulan = namaBulan(l.periode);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(doc.output("blob"));
      a.download = `${internal ? "Draft Internal - " : ""}Laporan Keuangan ${l.nama_outlet} ${bulan}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      disabled={busy}
      onClick={run}
      className="rounded-xl bg-matur-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
    >
      {busy ? "Menyiapkan…" : "⬇ Unduh PDF"}
    </button>
  );
}
