"use client";
import Image from "next/image";
import { useState, useTransition } from "react";
import { LoadingKasir } from "@/components/loading-kasir";
import { masukPos } from "@/lib/pos-tablet-actions";

const FITUR = [
  "🧾 Kasir & struk",
  "📋 Antrean barista",
  "💵 Kas shift",
  "📦 Stok real-time",
];

// Layar masuk POS outlet (tablet kasir & barista): maskot kasir + form username/password outlet.
export function MasukPos({ pesan, kunci }: { pesan?: string; kunci?: string }) {
  const [error, setError] = useState("");
  const [lihat, setLihat] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, start] = useTransition();
  const input =
    "w-full rounded-2xl border-2 border-matur-100 bg-white py-3.5 pl-12 pr-4 text-base text-kopi-900 outline-none transition focus:border-matur-500 focus:ring-4 focus:ring-matur-100";
  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-matur-50 via-white to-orange-50 p-4">
      {loading && <LoadingKasir teks="Masuk ke POS outlet…" />}
      <div className="pos-muncul grid w-full max-w-4xl overflow-hidden rounded-[2rem] bg-white shadow-[0_24px_60px_rgba(58,31,11,0.15)] md:grid-cols-[1.05fr_1fr]">
        <section className="relative flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-matur-400 via-orange-500 to-red-500 px-6 pb-8 pt-8 text-center text-white md:py-12">
          <span
            className="absolute -left-16 -top-16 size-48 rounded-full bg-white/10"
            aria-hidden
          />
          <span
            className="absolute -bottom-20 -right-10 size-56 rounded-full bg-white/10"
            aria-hidden
          />
          <div className="relative">
            <Image
              src="/mascot/kasir-pos.webp"
              alt="Maskot kasir Matoer"
              width={320}
              height={320}
              priority
              className="pos-maskot mx-auto w-44 drop-shadow-[0_18px_24px_rgba(58,31,11,0.35)] sm:w-56 md:w-72"
            />
            <span
              className="pos-bayang mx-auto -mt-2 block h-3 w-32 rounded-full bg-black/15 blur-sm"
              aria-hidden
            />
          </div>
          <h1 className="relative mt-4 text-3xl font-extrabold tracking-tight">
            Matoer POS
          </h1>
          <p className="relative mt-1 text-sm text-white/90">
            Kasir & barista outlet, satu tablet untuk satu tim.
          </p>
          <div className="relative mt-4 hidden flex-wrap justify-center gap-2 sm:flex">
            {FITUR.map((f) => (
              <span
                key={f}
                className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur"
              >
                {f}
              </span>
            ))}
          </div>
        </section>

        <form
          className="flex flex-col justify-center gap-4 p-6 sm:p-10"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setError("");
            setLoading(true);
            start(async () => {
              try {
                const r = await masukPos(
                  String(f.get("username")),
                  String(f.get("password")),
                );
                if (r.error) {
                  setError(r.error);
                  setLoading(false);
                } else location.href = "/pos";
              } catch {
                setError("Koneksi terputus. Coba lagi saat online.");
                setLoading(false);
              }
            });
          }}
        >
          <div>
            <p className="text-sm font-semibold text-matur-600">
              Selamat datang 👋
            </p>
            <h2 className="text-2xl font-extrabold text-kopi-900">
              {kunci ? "Masuk kembali" : "Masuk POS Outlet"}
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              {kunci ?? "Gunakan username dan password outlet dari admin."}
            </p>
          </div>
          {pesan && (
            <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">
              {pesan}
            </p>
          )}
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-kopi-900">
              Username outlet
            </span>
            <span className="relative block">
              <span
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg"
                aria-hidden
              >
                🏪
              </span>
              <input
                name="username"
                required
                autoCapitalize="none"
                autoComplete="username"
                placeholder="contoh: kominot.pos"
                className={input}
              />
            </span>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-kopi-900">
              Password outlet
            </span>
            <span className="relative block">
              <span
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg"
                aria-hidden
              >
                🔑
              </span>
              <input
                name="password"
                required
                type={lihat ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••••"
                className={`${input} pr-20`}
              />
              <button
                type="button"
                onClick={() => setLihat(!lihat)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-semibold text-matur-700 hover:bg-matur-50"
              >
                {lihat ? "Sembunyikan" : "Lihat"}
              </button>
            </span>
          </label>
          {error && (
            <p
              role="alert"
              className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
            >
              {error}
            </p>
          )}
          <button
            disabled={busy}
            className="mt-1 w-full rounded-2xl bg-gradient-to-r from-matur-500 to-orange-600 p-4 text-lg font-extrabold text-white shadow-lg shadow-orange-500/30 transition active:scale-[.98] disabled:opacity-60"
          >
            {busy ? "Memeriksa…" : "Masuk →"}
          </button>
          <p className="text-center text-xs text-stone-500">
            Absen, jadwal & slip gaji tetap di HP masing-masing lewat akun
            Matoer pribadi.
          </p>
        </form>
      </div>
    </div>
  );
}
