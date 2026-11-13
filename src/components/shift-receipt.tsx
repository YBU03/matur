"use client";
import { useEffect, useRef, useState } from "react";
import { laporanAlurOutlet } from "@/lib/pos-alur-actions";
import { autoPrintSekali } from "@/lib/auto-print";
import type { LaporanShift } from "@/lib/pos-alur";
import { barisAkhirShift } from "@/lib/shift-receipt";
import { cetakBluetooth, diAplikasi, namaPrinter, sambungPrinter, susunStruk } from "@/lib/printer-bt";
import { barisTeks } from "@/lib/struk-pdf";

/** Loading/printing failures are independent of successful closure. Manual actions remain available. */
export function ShiftReceipt({ outlet, sesi, awal, otomatis = false }: { outlet: string; sesi: string; awal?: LaporanShift; otomatis?: boolean }) {
  const [report, setReport] = useState(awal);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const printRef = useRef<HTMLPreElement>(null);
  const kertas = () => { try { return localStorage.getItem("matoer_kertas") === "80" ? "80" as const : "58" as const; } catch { return "58" as const; } };
  const unduh = async (r: LaporanShift) => {
    const [{ buatStrukPdf }, { unduh }] = await Promise.all([import("@/lib/struk-pdf"), import("@/lib/pdf-kop")]);
    unduh(await buatStrukPdf(barisAkhirShift(r), kertas()), `Akhir Shift ${r.outlet} ${r.sesi.tanggal_shift} ${sesi.slice(0, 8)}`);
  };
  const cetak = async (r: LaporanShift, manual = false): Promise<"sent" | "dialog"> => {
    if (manual && diAplikasi() && !namaPrinter()) await sambungPrinter();
    if (namaPrinter()) { await cetakBluetooth(susunStruk(barisAkhirShift(r), kertas() === "80" ? 48 : 32)); return "sent"; }
    if (diAplikasi()) throw Error("Pilih printer melalui menu Printer terlebih dahulu.");
    // Dedicated print document avoids printing the POS page or exposing unrelated UI.
    const frame = document.createElement("iframe");
    frame.title = "Cetak laporan akhir shift";
    frame.style.cssText = "position:fixed;width:0;height:0;border:0";
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    const win = frame.contentWindow;
    if (!doc || !win) { frame.remove(); throw Error("Dialog cetak belum dapat dibuka."); }
    doc.open(); doc.write('<!doctype html><html><head><title>Akhir Shift</title><style>@page{margin:3mm}body{margin:0}pre{font:10px/1.4 monospace;white-space:pre-wrap;max-width:72mm}</style></head><body><pre></pre></body></html>'); doc.close();
    doc.querySelector("pre")!.textContent = barisTeks(barisAkhirShift(r), kertas() === "80" ? 48 : 32).map((x) => x.teks).join("\n");
    win.focus(); win.print(); setTimeout(() => frame.remove(), 60000);
    return "dialog";
  };
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const r = awal ? { data: awal } : await laporanAlurOutlet(outlet, sesi);
        if (!live) return;
        if (!r.data) { setMsg(r.error ?? "Laporan belum termuat. Gunakan Muat ulang laporan."); return; }
        setReport(r.data);
        if (otomatis) {
          // PDF first; its failure must not prevent printing, and vice versa.
          const data = r.data;
          const hasil = await Promise.all([
            autoPrintSekali(`shift-pdf:${sesi}`, async () => { await unduh(data); return "sent"; }),
            autoPrintSekali(`shift-print:${sesi}`, () => cetak(data)),
          ]);
          if (live) setMsg(hasil.some((x) => x.status === "failed") ? "Shift tersimpan. Cetak/unduh otomatis belum lengkap; gunakan tombol manual di bawah." : "Cetak dan unduh otomatis sudah dicoba. Jika belum muncul, gunakan tombol manual.");
        }
      } catch { if (live) setMsg("Shift tersimpan. Laporan belum termuat; gunakan Muat ulang laporan."); }
    })();
    return () => { live = false; };
    // Snapshot sesi, never auto-print again on rerender.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outlet, sesi, otomatis]);
  const action = async (f: () => Promise<unknown>) => { setBusy(true); try { await f(); setMsg("Permintaan diproses. Jika belum keluar, coba tombol manual lagi."); } catch (e) { setMsg(e instanceof Error ? e.message : "Belum berhasil. Silakan coba kembali."); } finally { setBusy(false); } };
  return <section className="space-y-3 rounded-2xl border border-green-200 bg-green-50 p-4">
    <h3 className="font-bold text-green-950">Laporan akhir shift</h3>
    <div className="flex flex-wrap gap-2">
      <button disabled={busy || !report} className="rounded-xl bg-kopi-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" onClick={() => report && void action(() => cetak(report, true))}>Cetak manual / ulang</button>
      <button disabled={busy || !report} className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50" onClick={() => report && void action(() => unduh(report))}>Unduh PDF</button>
      <button disabled={busy} className="rounded-xl border bg-white px-4 py-2 text-sm" onClick={() => void action(async () => { const r = await laporanAlurOutlet(outlet, sesi); if (!r.data) throw Error(r.error ?? "Laporan belum termuat"); setReport(r.data); })}>Muat ulang laporan</button>
    </div>
    <p role="status" className="text-xs text-stone-600">{msg || "Laporan bisa dicetak atau diunduh kembali. Gangguan printer tidak membatalkan penutupan shift."}</p>
    {report && <details><summary className="cursor-pointer text-sm font-semibold">Lihat isi laporan</summary><pre ref={printRef} className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-white p-3 text-xs">{barisTeks(barisAkhirShift(report), 48).map((x) => x.teks).join("\n")}</pre></details>}
  </section>;
}
