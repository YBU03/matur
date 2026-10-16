"use client";
import { useState, useTransition } from "react";
import { masukPos } from "@/lib/pos-tablet-actions";
export function MasukPos({ pesan, kunci }: { pesan?: string; kunci?: string }) {
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  return (
    <form
      className="mx-auto mt-8 max-w-md space-y-4 rounded-3xl border bg-white p-6 shadow-sm"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        start(async () => {
          try {
            const r = await masukPos(
              String(f.get("username")),
              String(f.get("password")),
            );
            if (r.error) setError(r.error);
            else location.href = "/pos";
          } catch {
            setError("Koneksi terputus. Coba lagi saat online.");
          }
        });
      }}
    >
      <h1 className="text-2xl font-bold">Matoer POS Outlet</h1>
      <p className="text-sm text-stone-500">
        {kunci ?? "Gunakan username dan password outlet dari admin."}
      </p>
      {pesan && <p className="rounded-xl bg-amber-50 p-3 text-sm">{pesan}</p>}
      <label className="block text-sm font-semibold">
        Username outlet
        <input
          name="username"
          required
          autoCapitalize="none"
          autoComplete="username"
          className="mt-1 w-full rounded-xl border p-3"
        />
      </label>
      <label className="block text-sm font-semibold">
        Password outlet
        <input
          name="password"
          required
          type="password"
          autoComplete="current-password"
          className="mt-1 w-full rounded-xl border p-3"
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        disabled={busy}
        className="w-full rounded-xl bg-matur-500 p-3 font-bold text-white disabled:opacity-50"
      >
        {busy ? "Memeriksa…" : "Masuk POS Outlet"}
      </button>
      <p className="text-xs text-stone-500">
        Absen dan urusan pribadi tetap menggunakan akun Matoer masing-masing.
      </p>
    </form>
  );
}
