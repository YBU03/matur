"use client";

import { useState } from "react";
import { Modal } from "@/components/confirm-edit";
import { bisaBluetooth, cetakBluetooth, cetakRawBT, daftarPrinterAplikasi, diAndroid, diAplikasi, infoJalur, jalurBerikut, lupakanPrinterAplikasi, namaPrinter, pilihPrinterAplikasi, putusPrinter, sambungPrinter, simpanJalur, strukTes, type PrinterAplikasi } from "@/lib/printer-bt";

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
            {diAplikasi() ? (
              <PanelAplikasi
                nama={nama}
                sibuk={sibuk}
                onPilih={(alamat, n) => {
                  pilihPrinterAplikasi(alamat, n);
                  setNama(n);
                  setPesan({ ok: `Printer ${n} dipilih. Tekan Cetak tes.` });
                }}
                onLupakan={() => (lupakanPrinterAplikasi(), setNama(null), setPesan(null))}
                onTes={() =>
                  jalankan(async () => {
                    await cetakBluetooth(strukTes(lebar()));
                    return "Struk tes terkirim. Kalau kertas tidak keluar: pastikan printer menyala, kertas ada, dan tidak tersambung ke HP lain.";
                  })
                }
              />
            ) : bisaBluetooth() ? (
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
            {diAndroid() && !diAplikasi() && (
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

/** Aplikasi Android Matoer POS: pilih printer dari daftar yang sudah dipasangkan (paired) di Pengaturan Bluetooth tablet. */
function PanelAplikasi({ nama, sibuk, onPilih, onLupakan, onTes }: { nama: string | null; sibuk: boolean; onPilih: (alamat: string, nama: string) => void; onLupakan: () => void; onTes: () => void }) {
  const [d, setD] = useState<PrinterAplikasi>(() => daftarPrinterAplikasi());
  const muat = () => setD(daftarPrinterAplikasi());
  return (
    <div className="space-y-2">
      <p className="text-xs text-stone-500">
        1) Pasangkan (pair) printer sekali di <b>Pengaturan → Bluetooth</b> tablet. 2) Pilih printernya di bawah. 3) Cetak tes. Aplikasi mendukung printer Bluetooth klasik maupun BLE.
      </p>
      {!d.izin ? (
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Izinkan akses <b>Perangkat di sekitar / Bluetooth</b> yang muncul di layar, lalu tekan Muat ulang daftar.
        </div>
      ) : !d.ada ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">Tablet ini tidak punya Bluetooth.</p>
      ) : !d.aktif ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">Bluetooth tablet mati. Nyalakan Bluetooth lalu tekan Muat ulang daftar.</p>
      ) : !d.perangkat?.length ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">Belum ada perangkat yang dipasangkan. Pasangkan printer di Pengaturan Bluetooth tablet (PIN biasanya 0000 atau 1234).</p>
      ) : (
        <ul className="divide-y divide-stone-100 rounded-lg border">
          {d.perangkat.map((p) => (
            <li key={p.alamat} className="flex items-center gap-2 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{p.nama}</p>
                <p className="text-[11px] text-stone-500">{p.alamat} · {p.tipe}</p>
              </div>
              {nama === p.nama ? (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">Dipakai</span>
              ) : (
                <button disabled={sibuk} onClick={() => onPilih(p.alamat, p.nama)} className="rounded-lg bg-matur-500 px-3 py-1.5 text-xs font-semibold text-white">
                  Pilih
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        <button disabled={sibuk || !nama} onClick={onTes} className="rounded-lg bg-kopi-900 px-4 py-2 font-semibold text-white disabled:opacity-50">
          Cetak tes
        </button>
        <button disabled={sibuk} onClick={muat} className="rounded-lg border px-4 py-2">
          Muat ulang daftar
        </button>
        {nama && (
          <button onClick={onLupakan} className="rounded-lg px-3 py-2 text-red-600">
            Lupakan printer
          </button>
        )}
      </div>
    </div>
  );
}
