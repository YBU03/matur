"use client";

import { useEffect, useState } from "react";

// Tampil menutupi layar saat perangkat kehilangan koneksi internet, hilang otomatis saat tersambung lagi.
export function OfflineOverlay() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const cek = () => setOffline(!navigator.onLine);
    cek();
    window.addEventListener("online", cek);
    window.addEventListener("offline", cek);
    return () => {
      window.removeEventListener("online", cek);
      window.removeEventListener("offline", cek);
    };
  }, []);
  if (!offline) return null;
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-[#fffaf2]/95 p-6 text-center backdrop-blur-sm" role="alert">
      <div className="max-w-sm">
        {/* eslint-disable-next-line @next/next/no-img-element -- harus tetap tampil tanpa optimasi gambar server */}
        <img src="/mascot/404.png" alt="" className="mx-auto w-full max-w-xs" />
        <h1 className="mt-3 text-xl font-bold text-kopi-900">Koneksi internet terputus</h1>
        <p className="mt-1 text-sm text-stone-600">Periksa Wi-Fi atau data seluler. Halaman akan kembali normal otomatis saat tersambung.</p>
        <button onClick={() => location.reload()} className="mt-4 rounded-xl bg-matur-500 px-5 py-2.5 text-sm font-semibold text-white">
          Coba lagi
        </button>
      </div>
    </div>
  );
}
