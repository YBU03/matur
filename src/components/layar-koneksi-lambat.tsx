"use client";

// Ditampilkan saat halaman POS gagal dimuat (mis. server/database lambat). Hanya tampilan: tidak mengubah data apa pun.
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

export function LayarKoneksiLambat({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  const [pending, mulai] = useTransition();
  const [online, setOnline] = useState(true);
  useEffect(() => {
    console.error(error);
    const t = () => setOnline(navigator.onLine);
    t();
    window.addEventListener("online", t);
    window.addEventListener("offline", t);
    return () => {
      window.removeEventListener("online", t);
      window.removeEventListener("offline", t);
    };
  }, [error]);
  const coba = () =>
    mulai(() => {
      router.refresh();
      reset();
    });
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-matur-200 bg-white p-6 text-center shadow-sm">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-amber-50 text-3xl" aria-hidden>
          {online ? "🐢" : "📴"}
        </div>
        <h1 className="mt-3 text-lg font-bold text-kopi-900">{online ? "Koneksi lambat" : "Tidak ada internet"}</h1>
        <p className="mt-1 text-sm text-stone-600">
          {online
            ? "Server sedang lambat merespons. Data penjualan aman — coba muat lagi sebentar."
            : "Periksa Wi-Fi / data seluler perangkat, lalu coba lagi."}
        </p>
        <div className="mt-4 grid gap-2">
          <button
            type="button"
            onClick={coba}
            disabled={pending}
            className="rounded-xl bg-matur-500 py-3 text-base font-bold text-white shadow-sm disabled:opacity-60"
          >
            {pending ? "Memuat…" : "↻ Coba lagi"}
          </button>
          <button type="button" onClick={() => window.location.reload()} className="rounded-xl border border-matur-300 py-2 text-sm font-semibold text-kopi-700">
            Muat ulang halaman
          </button>
        </div>
        {error.digest && <p className="mt-3 text-[10px] text-stone-400">Kode: {error.digest}</p>}
      </div>
    </div>
  );
}
