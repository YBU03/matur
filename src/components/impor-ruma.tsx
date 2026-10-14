"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Modal } from "@/components/confirm-edit";
import { formatRupiah } from "@/lib/format";
import { LABEL_KANAL, type KanalHarian } from "@/lib/harian";
import { imporHarian, imporLaporan } from "@/lib/impor-actions";
import { hitung, type Laporan } from "@/lib/laporan";
import { gridDariSheet, parseLaporan, parseTransaksi, type HariImpor, type LaporanImpor } from "@/lib/ruma-excel";

type Hasil = { nama: string; hari: HariImpor[] | null; lap: LaporanImpor | null; galat: string[] };

/** Impor file Excel Ruma (sheet "Transaksi" + "Laporan Keuangan") ke Catatan Harian & Laporan Keuangan. */
export function ImporRuma({ outlets, outletId, label = "⬆ Impor Excel" }: { outlets: { id: string; nama: string }[]; outletId: string; label?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [buka, setBuka] = useState(false);
  const [baca, setBaca] = useState(false);
  const [h, setH] = useState<Hasil | null>(null);
  const [outlet, setOutlet] = useState(outletId);
  const [pakaiHarian, setPakaiHarian] = useState(true);
  const [pakaiLap, setPakaiLap] = useState(true);
  const [ganti, setGanti] = useState(true);
  const [gantiLap, setGantiLap] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }[]>([]);

  const pilih = async (f?: File) => {
    if (!f) return;
    setBaca(true);
    setMsg([]);
    try {
      const { Workbook } = (await import("exceljs")).default;
      const wb = new Workbook();
      await wb.xlsx.load(await f.arrayBuffer());
      const galat: string[] = [];
      const cariSheet = (re: RegExp) => wb.worksheets.find((w) => re.test(w.name));
      let hari: HariImpor[] | null = null, lap: LaporanImpor | null = null;
      const st = cariSheet(/^transaksi/i);
      if (st) try { hari = parseTransaksi(gridDariSheet(st as never)).hari; } catch (e) { galat.push(`Sheet Transaksi: ${(e as Error).message}`); }
      else galat.push('Sheet "Transaksi" tidak ada — catatan harian dilewati.');
      const sl = cariSheet(/laporan keuangan/i);
      if (sl) try { lap = parseLaporan(gridDariSheet(sl as never)); } catch (e) { galat.push(`Sheet Laporan Keuangan: ${(e as Error).message}`); }
      else galat.push('Sheet "Laporan Keuangan" tidak ada — laporan bulanan dilewati.');
      setPakaiHarian(!!hari?.length);
      setPakaiLap(!!lap?.periode);
      setH({ nama: f.name, hari, lap, galat });
    } catch (e) {
      setH({ nama: f.name, hari: null, lap: null, galat: [`File tidak bisa dibaca: ${(e as Error).message}`] });
    } finally {
      setBaca(false);
    }
  };

  const bulanFile = h?.lap?.periode ?? (h?.hari?.length ? modus(h.hari.map((x) => x.tanggal.slice(0, 7))) : null);
  const jual: Record<string, number> = {};
  let keluar = 0, nKeluar = 0;
  for (const x of (h?.hari ?? []).filter((x) => bulanFile && x.tanggal.startsWith(bulanFile))) {
    for (const [k, v] of Object.entries(x.jual)) jual[k] = (jual[k] ?? 0) + Number(v);
    for (const b of x.biaya) (keluar += b.jumlah), nKeluar++;
  }
  const hl = h?.lap ? hitung({ ...h.lap, laba_bersih: null, tagihan_titipan: h.lap.tagihan_titipan } as unknown as Laporan) : null;

  const impor = () =>
    start(async () => {
      const out: { ok?: string; error?: string }[] = [];
      if (pakaiHarian && h?.hari && bulanFile) out.push(await imporHarian(outlet, bulanFile, h.hari, ganti));
      if (pakaiLap && h?.lap) out.push(await imporLaporan(outlet, h.lap, gantiLap));
      setMsg(out);
      if (out.every((x) => !x.error)) router.refresh();
    });

  return (
    <>
      <button onClick={() => (setBuka(true), setH(null), setMsg([]))} className="rounded-xl border border-violet-400 bg-white px-3 py-2 text-sm font-semibold text-violet-700">
        {label}
      </button>
      {buka && (
        <Modal title="Impor file Excel Ruma">
          <div className="max-h-[70vh] space-y-3 overflow-y-auto text-sm">
            <p className="text-xs text-stone-500">File laporan Ruma berisi sheet <b>Transaksi</b> (catatan harian) dan <b>Laporan Keuangan</b>. Keduanya bisa diimpor sekaligus, mis. data bulan Oktober sebelum memakai POS Matoer.</p>
            <label className="block font-semibold">
              Outlet
              <select value={outlet} onChange={(e) => setOutlet(e.target.value)} className="mt-1 block w-full rounded-lg border px-3 py-2 font-normal">
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nama}
                  </option>
                ))}
              </select>
            </label>
            <input type="file" accept=".xlsx" disabled={baca} onChange={(e) => (pilih(e.target.files?.[0]), (e.target.value = ""))} className="block w-full text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-violet-600 file:px-3 file:py-2 file:text-white" />
            {baca && <p className="text-xs text-stone-500">Membaca file…</p>}
            {h && (
              <div className="space-y-2 rounded-xl bg-stone-50 p-3">
                <p className="font-semibold">
                  {h.nama} {bulanFile && <span className="font-normal text-stone-500">· bulan {bulanFile}</span>}
                </p>
                {h.galat.map((g) => (
                  <p key={g} className="text-xs text-amber-700">⚠ {g}</p>
                ))}
                {h.hari && (
                  <label className="flex items-start gap-2 rounded-lg border bg-white p-2">
                    <input type="checkbox" checked={pakaiHarian} onChange={(e) => setPakaiHarian(e.target.checked)} className="mt-1 accent-violet-600" />
                    <span className="flex-1">
                      <b>Catatan harian</b> — {h.hari.filter((x) => bulanFile && x.tanggal.startsWith(bulanFile)).length} tanggal, {nKeluar} pengeluaran ({formatRupiah(keluar)})
                      <span className="mt-1 grid grid-cols-2 gap-x-3 text-xs text-stone-600">
                        {Object.entries(jual).map(([k, v]) => (
                          <span key={k}>
                            {LABEL_KANAL[k as KanalHarian] ?? k}: <b>{formatRupiah(v)}</b>
                          </span>
                        ))}
                      </span>
                      {h.hari.some((x) => bulanFile && !x.tanggal.startsWith(bulanFile)) && <span className="block text-xs text-amber-700">Ada tanggal di luar bulan {bulanFile} (kemungkinan salah ketik) — akan dilewati.</span>}
                    </span>
                  </label>
                )}
                {h.lap && (
                  <label className="flex items-start gap-2 rounded-lg border bg-white p-2">
                    <input type="checkbox" checked={pakaiLap} disabled={!h.lap.periode} onChange={(e) => setPakaiLap(e.target.checked)} className="mt-1 accent-violet-600" />
                    <span className="flex-1">
                      <b>Laporan keuangan {h.lap.periode ?? "(periode tidak terbaca)"}</b> — {h.lap.nama_outlet}
                      {hl && (
                        <span className="mt-1 grid grid-cols-2 gap-x-3 text-xs text-stone-600">
                          <span>Total penjualan: <b>{formatRupiah(hl.totalPenjualan)}</b></span>
                          <span>HPP: <b>{formatRupiah(hl.hpp)}</b></span>
                          <span>Laba kotor: <b>{formatRupiah(hl.labaKotor)}</b></span>
                          <span>Sedekah {String(h.lap.persen_sedekah).replace(".", ",")}%: <b>{formatRupiah(h.lap.sedekah)}</b></span>
                          <span>Laba bersih: <b>{formatRupiah(hl.labaBersih)}</b></span>
                          <span>Bagi hasil: <b>{h.lap.bagi_hasil.length} pihak</b></span>
                        </span>
                      )}
                    </span>
                  </label>
                )}
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={ganti} onChange={(e) => setGanti(e.target.checked)} className="accent-violet-600" />
                  Ganti hasil impor sebelumnya di bulan ini (input manual & data POS tidak terhapus)
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={gantiLap} onChange={(e) => setGantiLap(e.target.checked)} className="accent-red-600" />
                  Timpa laporan keuangan bulan ini bila sudah terbit
                </label>
              </div>
            )}
            {msg.map((m, i) => (
              <p key={i} className={`rounded-lg px-3 py-2 text-xs ${m.error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
                {m.error ?? m.ok}
              </p>
            ))}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setBuka(false)} className="rounded-lg border px-4 py-2 text-sm">
              Tutup
            </button>
            <button disabled={pending || !h || (!(pakaiHarian && h.hari) && !(pakaiLap && h.lap))} onClick={impor} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
              {pending ? "Mengimpor…" : "Impor"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function modus(xs: string[]) {
  const n = new Map<string, number>();
  for (const x of xs) n.set(x, (n.get(x) ?? 0) + 1);
  return [...n].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}
