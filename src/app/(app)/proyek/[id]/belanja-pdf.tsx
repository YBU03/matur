"use client";
import { useState } from "react";
import type { LaporanBelanja } from "@/lib/belanja-proyek-pdf";

export function BelanjaPdf({ data }: { data: LaporanBelanja }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function download() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const { buatPdfRealisasi } = await import("@/lib/belanja-proyek-pdf");
      const doc = await buatPdfRealisasi(data);
      doc.save(`Realisasi Belanja ${data.nama}.pdf`.replace(/[\\/:*?"<>|]/g, "-"));
    } catch { setError("PDF belum berhasil dibuat. Silakan coba lagi."); }
    finally { setBusy(false); }
  }
  return <div><button type="button" disabled={busy} onClick={download} className="rounded-lg border border-matur-300 bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50">{busy ? "Menyiapkan PDF…" : "Download PDF Realisasi"}</button>{error && <p role="alert" className="mt-1 text-xs text-red-700">{error}</p>}</div>;
}
