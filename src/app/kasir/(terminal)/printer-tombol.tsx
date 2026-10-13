"use client";

import { useState } from "react";
import { Modal } from "@/components/confirm-edit";
import { bisaBluetooth, cetakBluetooth, cetakRawBT, diAndroid, namaPrinter, putusPrinter, sambungPrinter, strukTes } from "@/lib/printer-bt";

// Sambungkan printer thermal sekali per sesi aplikasi, lalu struk bisa langsung dicetak dari layar kasir.
export function PrinterTombol() {
  const [buka, setBuka] = useState(false);
  const [nama, setNama] = useState<string | null>(null);
  const [pesan, setPesan] = useState<{ ok?: string; err?: string } | null>(null);
  const [sibuk, setSibuk] = useState(false);
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
    }
  };
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
                <p className="text-xs text-stone-500">1) Nyalakan printer & Bluetooth tablet. 2) Tekan Sambungkan, pilih nama printer (mis. RPP02N, MTP-II, BlueTooth Printer). 3) Cetak tes.</p>
                <div className="flex flex-wrap gap-2">
                  <button disabled={sibuk} onClick={() => jalankan(async () => `Tersambung ke ${await sambungPrinter()}.`)} className="rounded-lg bg-matur-500 px-4 py-2 font-semibold text-white disabled:opacity-50">
                    {nama ? "Ganti printer" : "Sambungkan printer"}
                  </button>
                  <button
                    disabled={sibuk || !nama}
                    onClick={() =>
                      jalankan(async () => {
                        await cetakBluetooth(strukTes(lebar()));
                        return "Struk tes terkirim. Cek hasil cetaknya.";
                      })
                    }
                    className="rounded-lg border px-4 py-2 disabled:opacity-50"
                  >
                    Cetak tes
                  </button>
                  {nama && (
                    <button onClick={() => (putusPrinter(), setNama(null))} className="rounded-lg px-3 py-2 text-red-600">
                      Putuskan
                    </button>
                  )}
                </div>
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
