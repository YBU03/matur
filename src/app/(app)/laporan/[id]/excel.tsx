"use client";

import { useState } from "react";
import { namaBulan, type Laporan, type Perusahaan } from "@/lib/laporan";
import { isiSheetLaporan } from "@/lib/laporan-excel";

/** Unduh laporan resmi sebagai Excel format Ruma (sheet "Laporan Keuangan"), bisa diimpor kembali. */
export function UnduhExcel({ l, pt }: { l: Laporan; pt: Perusahaan }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const { Workbook } = (await import("exceljs")).default;
      const wb = new Workbook();
      isiSheetLaporan(wb.addWorksheet("Laporan Keuangan"), l, pt);
      const blob = new Blob([await wb.xlsx.writeBuffer()], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `Laporan Keuangan ${l.nama_outlet} ${namaBulan(l.periode)}.xlsx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } finally {
      setBusy(false);
    }
  };
  return (
    <button disabled={busy} onClick={run} className="rounded-xl border border-green-600 bg-white px-3 py-2 text-sm font-semibold text-green-700 disabled:opacity-50">
      {busy ? "Menyiapkan…" : "⬇ Excel"}
    </button>
  );
}
