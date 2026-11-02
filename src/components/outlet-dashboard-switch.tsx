"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { aturTampilDashboardPos } from "@/lib/outlet-dashboard-actions";

export function OutletDashboardSwitch({
  id,
  nama,
  tampil,
}: {
  id: string;
  nama: string;
  tampil: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(tampil);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const lock = useRef(false);
  useEffect(() => setValue(tampil), [tampil]);
  const toggle = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const r = await aturTampilDashboardPos(id, value, !value);
      if (r.error) {
        setError(r.error);
        return;
      }
      if (typeof r.value !== "boolean")
        throw new Error("Pengaturan belum tersimpan. Silakan coba lagi.");
      setValue(r.value);
      setSaved(true);
      router.refresh();
    } catch {
      setError(
        "Pengaturan belum dapat disimpan. Periksa koneksi lalu coba lagi.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <section className="mt-3 rounded-xl border border-stone-200 bg-stone-50/70 p-3">
      <p className="text-xs font-bold text-kopi-900">
        Tampilkan di Dashboard POS
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-stone-600">
        Mengatur apakah outlet dan transaksinya ikut ringkasan serta grafik
        Dashboard POS.
      </p>
      <button
        type="button"
        role="switch"
        aria-label={`Tampilkan ${nama} di Dashboard POS`}
        aria-checked={value}
        aria-busy={busy}
        disabled={busy}
        onClick={toggle}
        className={`mt-2 flex min-h-11 w-full items-center gap-2 rounded-xl border-2 px-3 py-2 text-left text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kopi-900 disabled:cursor-wait ${value ? "border-green-700 bg-green-700 text-white" : "border-red-700 bg-red-700 text-white"}`}
      >
        <span
          aria-hidden="true"
          className={`flex h-6 w-11 shrink-0 items-center rounded-full bg-black/20 p-0.5 ${value ? "justify-end" : "justify-start"}`}
        >
          <span className="grid size-5 place-items-center rounded-full bg-white text-[11px] text-stone-800 shadow-sm">
            {value ? "✓" : "×"}
          </span>
        </span>
        <span>
          {busy
            ? "Menyimpan…"
            : value
              ? "ON — Ditampilkan"
              : "OFF — Disembunyikan"}
        </span>
      </button>
      {error && (
        <p
          role="alert"
          className="mt-2 break-words text-xs font-semibold text-red-700"
        >
          {error}
        </p>
      )}
      {saved && !error && (
        <p
          role="status"
          className="mt-2 text-[11px] font-semibold text-green-800"
        >
          ✓ Pengaturan tersimpan
        </p>
      )}
    </section>
  );
}
