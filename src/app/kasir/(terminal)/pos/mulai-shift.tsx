"use client";

import { useState, useTransition } from "react";
import { mulaiShiftPin, mulaiShiftSaya } from "@/lib/shift-actions";

export type StafShift = { id: string; nama: string; peran: string; ada_pin: boolean; sesi_id: string | null };
const num = (v: string) => Math.round(Number(v.replace(/[^\d]/g, "")) || 0);
const warna = ["bg-rose-500", "bg-amber-500", "bg-emerald-500", "bg-sky-500", "bg-violet-500", "bg-pink-500", "bg-teal-500"];

// Layar mulai shift di perangkat outlet: staf pilih namanya lalu masukkan PIN.
// Perangkat tetap login; shift (sesi kas) tercatat atas nama staf yang memasukkan PIN.
export function MulaiShift({ outletNama, staf, meId, meNama }: { outletNama: string; staf: StafShift[]; meId: string; meNama: string }) {
  const [pilih, setPilih] = useState<StafShift | null>(null);
  const [pin, setPin] = useState("");
  const [modal, setModal] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const saya = staf.find((x) => x.id === meId);
  const lain = staf.filter((x) => x.id !== meId);

  const kirim = (p = pin) =>
    start(async () => {
      setErr("");
      const r = pilih?.id === meId ? await mulaiShiftSaya(num(modal)) : await mulaiShiftPin(pilih!.id, p, num(modal));
      if (r.error) {
        setErr(r.error);
        setPin("");
      }
    });
  const tekan = (d: string) => {
    if (pending) return;
    const p = d === "⌫" ? pin.slice(0, -1) : (pin + d).slice(0, 6);
    setPin(p);
  };

  return (
    <div className="mx-auto mt-6 max-w-lg rounded-2xl border border-matur-200 bg-white p-5 shadow-sm">
      <h1 className="text-xl font-bold">Mulai Shift</h1>
      <p className="mb-4 text-sm text-stone-500">{outletNama} · pilih nama kasir yang bertugas, lalu masukkan PIN.</p>

      {!pilih && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[...(saya ? [saya] : [{ id: meId, nama: meNama, peran: "akun ini", ada_pin: true, sesi_id: null }]), ...lain].map((x, i) => (
            <button
              key={x.id}
              onClick={() => (setPilih(x), setPin(""), setErr(""))}
              disabled={x.id !== meId && !x.ada_pin}
              className="flex flex-col items-center gap-1 rounded-2xl border-2 border-stone-200 p-3 text-center hover:border-matur-500 disabled:opacity-40"
              title={x.id !== meId && !x.ada_pin ? "PIN belum diatur HRD" : undefined}
            >
              <span className={`flex size-12 items-center justify-center rounded-full text-lg font-bold text-white ${warna[i % warna.length]}`}>{x.nama.slice(0, 1).toUpperCase()}</span>
              <span className="text-sm font-semibold leading-tight">{x.nama}</span>
              <span className="text-[11px] text-stone-500">
                {x.id === meId ? "akun di perangkat ini" : x.ada_pin ? x.peran.toUpperCase() : "PIN belum diatur"}
                {x.sesi_id && " · shift masih buka"}
              </span>
            </button>
          ))}
        </div>
      )}

      {pilih && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <button onClick={() => setPilih(null)} className="rounded-lg border px-2 py-1 text-sm">
              ← Ganti
            </button>
            <p className="font-semibold">{pilih.nama}</p>
            {pilih.sesi_id && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">lanjutkan shift yang masih buka</span>}
          </div>
          {!pilih.sesi_id && (
            <label className="block text-sm font-medium">
              Modal awal laci
              <input value={modal ? num(modal).toLocaleString("id-ID") : ""} onChange={(e) => setModal(e.target.value)} inputMode="numeric" placeholder="200.000" className="mt-1 w-full rounded-lg border px-3 py-2 text-right" />
            </label>
          )}
          {pilih.id !== meId && (
            <>
              <div className="flex justify-center gap-2" aria-label="PIN">
                {Array.from({ length: 6 }, (_, i) => (
                  <span key={i} className={`size-3.5 rounded-full ${i < pin.length ? "bg-kopi-900" : "bg-stone-200"}`} />
                ))}
              </div>
              <div className="mx-auto grid max-w-xs grid-cols-3 gap-2">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((d, i) =>
                  d ? (
                    <button key={i} onClick={() => tekan(d)} className="rounded-xl bg-stone-100 py-3 text-xl font-bold active:bg-stone-200">
                      {d}
                    </button>
                  ) : (
                    <span key={i} />
                  ),
                )}
              </div>
            </>
          )}
          {err && <p className="text-center text-sm text-red-600">{err}</p>}
          <button
            disabled={pending || (pilih.id !== meId && pin.length < 4)}
            onClick={() => kirim()}
            className="w-full rounded-xl bg-matur-500 py-3 font-semibold text-white disabled:opacity-60"
          >
            {pending ? "Memeriksa…" : pilih.sesi_id ? "Lanjutkan shift" : "Mulai shift"}
          </button>
        </div>
      )}
      <p className="mt-4 text-xs text-stone-500">PIN diatur HRD di menu Karyawan. Serah terima: kasir lama tutup shift (setor kas) → kasir berikutnya mulai shift dengan PIN-nya.</p>
    </div>
  );
}
