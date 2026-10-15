"use client";
import Image from "next/image";
import { useState, useTransition } from "react";
import { masukPos, type OutletPos } from "@/lib/pos-tablet-actions";

// Login POS tablet: cukup kode staf + PIN dari HRD. Outlet mengikuti tempat staf bertugas.
export function MasukPos({ pesan }: { pesan?: string }) {
  const [kode, setKode] = useState("");
  const [pin, setPin] = useState("");
  const [pilih, setPilih] = useState<OutletPos[] | null>(null);
  const [err, setErr] = useState("");
  const [busy, start] = useTransition();
  const cls = "mt-1 w-full rounded-xl border border-stone-300 p-3 text-lg";
  const kirim = (outlet: string | null) =>
    start(async () => {
      setErr("");
      try {
        const r = await masukPos(kode, pin, outlet);
        if (r.error) return setErr(r.error);
        if (r.pilih) return setPilih(r.pilih);
        location.href = `/pos?kode=${encodeURIComponent(kode.trim().toLowerCase())}`;
      } catch {
        setErr("Koneksi terputus. Coba lagi saat online.");
      }
    });
  return (
    <div className="mx-auto mt-8 max-w-md space-y-4 rounded-3xl border bg-white p-6 shadow-sm">
      <div className="text-center">
        <Image
          src="/brand/logo-192.png"
          alt="Matoer"
          width={64}
          height={64}
          className="mx-auto rounded-2xl"
        />
        <h1 className="mt-3 text-2xl font-bold">Matoer POS</h1>
        <p className="mt-1 text-sm text-stone-500">
          Masuk dengan kode staf dan PIN POS dari HRD.
        </p>
      </div>
      {pesan && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          {pesan}
        </p>
      )}
      {!pilih ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            kirim(null);
          }}
        >
          <label className="block text-sm font-semibold">
            Kode staf
            <input
              value={kode}
              onChange={(e) => setKode(e.target.value)}
              required
              autoCapitalize="none"
              autoComplete="off"
              className={cls}
            />
          </label>
          <label className="block text-sm font-semibold">
            PIN POS
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              required
              type="password"
              inputMode="numeric"
              pattern="[0-9]{4,6}"
              maxLength={6}
              autoComplete="off"
              className={`${cls} tracking-widest`}
            />
          </label>
          <button
            disabled={busy}
            className="w-full rounded-xl bg-matur-500 p-3 text-lg font-bold text-white disabled:opacity-50"
          >
            {busy ? "Memeriksa…" : "Masuk"}
          </button>
        </form>
      ) : (
        <div className="space-y-2">
          <p className="text-sm font-semibold">
            Anda bertugas di beberapa outlet. Tablet ini untuk outlet mana?
          </p>
          {pilih.map((o) => (
            <button
              key={o.id}
              disabled={busy}
              onClick={() => kirim(o.id)}
              className="w-full rounded-xl border-2 border-matur-300 p-3 text-left font-semibold disabled:opacity-50"
            >
              {o.nama}
            </button>
          ))}
          <button onClick={() => setPilih(null)} className="text-sm underline">
            Kembali
          </button>
        </div>
      )}
      {err && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
        >
          {err}
        </p>
      )}
      <p className="text-center text-xs text-stone-500">
        Absen, jadwal, izin & slip gaji tetap di HP masing-masing (/karyawan).
      </p>
    </div>
  );
}
