"use client";

import { useState } from "react";
import { Modal } from "@/components/confirm-edit";
import { bisaBluetooth, cetakBluetooth, cetakRawBT, diAndroid, infoJalur, jalurBerikut, namaPrinter, putusPrinter, sambungPrinter, simpanJalur, strukTes } from "@/lib/printer-bt";

// Sambungkan printer thermal sekali per sesi aplikasi, lalu struk bisa langsung dicetak dari layar kasir.
export function PrinterTombol() {
  const [buka, setBuka] = useState(false);
  const [nama, setNama] = useState<string | null>(null);
  const [pesan, setPesan] = useState<{ ok?: string; err?: string } | null>(null);
  const [sibuk, setSibuk] = useState(false);
  // setelah cetak tes: tanya apakah struk keluar; bila tidak, coba jalur cetak berikutnya
  const [tanya, setTanya] = useState(false);
  const [dicoba, setDicoba] = useState(0);
  const [info, setInfo] = useState(infoJalur());
  const lebar = () => {
    try {
      return localStorage.getItem("matoer_kertas") === "80" ? 48 : 32;
    } catch {
      return 32;
    }
  };
  const jalankan = async (fn: () => Promise<string>) => {
    setSibuk(true);
    setPesan(null);
    try {
      setPesan({ ok: await fn() });
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      setPesan({ err: /cancel|chooser/i.test(m) ? "Pemilihan printer dibatalkan." : m });
    } finally {
      setSibuk(false);
      setNama(namaPrinter());
      setInfo(infoJalur());
    }
  };
  const cetakTes = (ulang = false) =>
    jalankan(async () => {
      await cetakBluetooth(strukTes(lebar()));
      setTanya(true);
      const i = infoJalur();
      return ulang && i ? `Mencoba jalur ${i.ke} dari ${i.total}. Apakah struk tes keluar sekarang?` : "Struk tes terkirim. Apakah kertasnya keluar?";
    });
  return (
    <>
      <button onClick={() => (setBuka(true), setNama(namaPrinter()))} className="rounded-lg border border-matur-300 px-3 py-1.5 text-sm font-semibold text-matur-700" title="Printer struk">
        🖨 {namaPrinter() ?? "Printer"}
      </button>
      {buka && (
        <Modal title="🖨 Printer struk">
          <div className="space-y-3 text-sm">
            <p className="rounded-lg bg-matur-50 px-3 py-2">
              Status: <b>{nama ? `Tersambung — ${nama}` : "Belum tersambung"}</b> · kertas {lebar() === 32 ? "58" : "80"} mm <span className="text-xs text-stone-500">(ubah di layar struk)</span>
            </p>
            {bisaBluetooth() ? (
              <div className="space-y-2">
                <p className="text-xs text-stone-500">1) Nyalakan printer & Bluetooth tablet (pastikan printer tidak sedang tersambung ke HP/aplikasi lain). 2) Tekan Sambungkan, pilih nama printer (mis. RPP02N, MTP-II). 3) Cetak tes, lalu jawab apakah kertasnya keluar. Sistem mencari jalur cetak yang cocok dan mengingatnya per printer.</p>
                <div className="flex flex-wrap gap-2">
                  <button disabled={sibuk} onClick={() => (setTanya(false), setDicoba(0), jalankan(async () => `Tersambung ke ${await sambungPrinter()}. Lanjut tekan Cetak tes.`))} className="rounded-lg bg-matur-500 px-4 py-2 font-semibold text-white disabled:opacity-50">
                    {nama ? "Ganti printer" : "Sambungkan printer"}
                  </button>
                  <button
                    disabled={sibuk || !nama}
                    onClick={() => (setDicoba(0), cetakTes())}
                    className="rounded-lg border px-4 py-2 disabled:opacity-50"
                  >
                    Cetak tes
                  </button>
                  {nama && (
                    <button onClick={() => (putusPrinter(), setNama(null), setInfo(null), setTanya(false))} className="rounded-lg px-3 py-2 text-red-600">
                      Putuskan
                    </button>
                  )}
                </div>
                {nama && info && (
                  <p className="text-[11px] text-stone-500">
                    Jalur cetak: <b>{info.label}</b> ({info.ke}/{info.total}){info.tersimpan ? " · ✓ tersimpan untuk printer ini" : info.dikenal ? " · jalur cetak umum" : ""}
                  </p>
                )}
                {tanya && nama && (
                  <div className="rounded-lg border border-matur-200 bg-white p-3">
                    <p className="mb-2 font-semibold">Apakah struk tes keluar?</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        disabled={sibuk}
                        onClick={() => {
                          simpanJalur();
                          setTanya(false);
                          setInfo(infoJalur());
                          setPesan({ ok: "Siap! Jalur cetak disimpan untuk printer ini. Struk berikutnya otomatis lewat jalur ini." });
                        }}
                        className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white"
                      >
                        ✅ Keluar
                      </button>
                      <button
                        disabled={sibuk}
                        onClick={() => {
                          const total = infoJalur()?.total ?? 1;
                          if (dicoba + 1 >= total) {
                            setTanya(false);
                            setPesan({ err: "Semua jalur sudah dicoba. Matikan lalu nyalakan printer, pastikan printer tidak sedang tersambung ke HP/aplikasi lain (mis. Luna POS), lalu tekan Ganti printer dan coba lagi. Cadangan: RawBT di bawah." });
                            return;
                          }
                          setDicoba(dicoba + 1);
                          jalurBerikut();
                          cetakTes(true);
                        }}
                        className="rounded-lg border border-red-200 px-4 py-2 font-semibold text-red-700"
                      >
                        ❌ Tidak keluar, coba jalur lain
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">Browser ini tidak bisa mengakses Bluetooth langsung. Pakai Google Chrome di tablet Android, atau aplikasi RawBT di bawah.</p>
            )}
            {diAndroid() && (
              <div className="border-t pt-3">
                <p className="text-xs text-stone-500">
                  Printer tidak muncul di daftar / tidak bisa tersambung? Banyak printer memakai Bluetooth <b>klasik</b> yang tidak bisa diakses browser. Pasang aplikasi gratis <b>RawBT</b> dari Play Store, pasangkan printernya di RawBT, lalu pakai tombol ini.
                </p>
                <button onClick={() => cetakRawBT(strukTes(lebar()))} className="mt-2 rounded-lg border px-4 py-2">
                  Cetak tes lewat RawBT
                </button>
              </div>
            )}
            {pesan && <p className={`rounded-lg px-3 py-2 text-xs ${pesan.err ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>{pesan.err ?? pesan.ok}</p>}
          </div>
          <div className="mt-4 text-right">
            <button onClick={() => setBuka(false)} className="rounded-lg border px-4 py-2 text-sm">
              Tutup
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
