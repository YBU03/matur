"use client";
import { useEffect, useRef, useState } from "react";
export type PreviewPDF = { url: string; nama: string };
export function usePreviewDokumen() {
  const [pdf, setPdf] = useState<PreviewPDF | null>(null);
  const url = pdf?.url;
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  return [pdf, setPdf] as const;
}
export function PreviewDokumen({
  pdf,
  onClose,
}: {
  pdf: PreviewPDF;
  onClose: () => void;
}) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.key === "Escape") close.current();
    };
    window.addEventListener("keydown", f);
    return () => {
      window.removeEventListener("keydown", f);
    };
  }, [pdf.url]);
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-2 sm:p-5">
      <section
        role="dialog"
        aria-modal
        aria-label="Pratinjau Dokumen"
        className="flex h-[94dvh] w-full max-w-6xl flex-col gap-3 rounded-2xl bg-white p-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">Pratinjau Dokumen</h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border px-3 py-2 text-sm"
            >
              Kembali Edit / Tutup
            </button>
            <a
              href={pdf.url}
              download={pdf.nama + ".pdf"}
              className="rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-white"
            >
              Download PDF
            </a>
            <a
              href={pdf.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg bg-stone-800 px-3 py-2 text-sm text-white"
            >
              Cetak
            </a>
          </div>
        </div>
        <p className="text-xs text-stone-600">
          Periksa hasil sebelum download. Cetak membuka penampil PDF browser;
          gunakan ikon printer di sana. Bila pratinjau tidak didukung perangkat,
          buka melalui tombol Cetak.
        </p>
        <iframe
          title="Hasil dokumen PDF"
          src={pdf.url}
          className="min-h-0 w-full flex-1 rounded-lg border bg-stone-100"
        />
      </section>
    </div>
  );
}
