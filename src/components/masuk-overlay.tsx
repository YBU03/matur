"use client";

// Layar "masuk" penuh dengan maskot sesuai peran, tampil saat memilih peran / login.
// Dipasang di root layout agar tetap tampil melewati perpindahan halaman, lalu hilang sendiri
// setelah halaman tujuan selesai dimuat (tidak ada lagi elemen aria-busy), minimal ±0,8 detik.

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type Info = { mascot?: string; label: string };
const MULAI = "matoer:masuk";
const SELESAI = "matoer:masuk-selesai";
const MIN_MS = 800;
const SLOW_MS = 20000;

export const mulaiMasuk = (info: Info) =>
  window.dispatchEvent(new CustomEvent(MULAI, { detail: info }));
export const batalMasuk = () => window.dispatchEvent(new Event(SELESAI));

export function MasukOverlay() {
  const pathname = usePathname();
  const [aktif, setAktif] = useState<
    (Info & { dari: string; t: number }) | null
  >(null);
  const [keluar, setKeluar] = useState(false);
  const [lambat, setLambat] = useState(false);

  useEffect(() => {
    const mulai = (e: Event) => {
      setKeluar(false);
      setLambat(false);
      setAktif({
        ...(e as CustomEvent<Info>).detail,
        dari: window.location.pathname,
        t: Date.now(),
      });
    };
    const selesai = () => setAktif(null);
    window.addEventListener(MULAI, mulai);
    window.addEventListener(SELESAI, selesai);
    return () => {
      window.removeEventListener(MULAI, mulai);
      window.removeEventListener(SELESAI, selesai);
    };
  }, []);

  // tutup setelah pindah halaman dan isi halaman tujuan siap
  useEffect(() => {
    if (!aktif) return;
    // A follow-up redirect must keep the overlay visible while its target loads.
    setKeluar(false);
    let fade: ReturnType<typeof setTimeout> | undefined;
    const id = setInterval(() => {
      const lama = Date.now() - aktif.t;
      const siap =
        pathname !== aktif.dari &&
        pathname !== "/masuk" &&
        !document.querySelector('[aria-busy="true"]:not([data-overlay])');
      if (lama > SLOW_MS) setLambat(true);
      if (siap && lama >= MIN_MS) {
        clearInterval(id);
        setKeluar(true);
        fade = setTimeout(() => setAktif(null), 300);
      }
    }, 100);
    return () => {
      clearInterval(id);
      if (fade) clearTimeout(fade);
    };
  }, [aktif, pathname]);

  if (!aktif) return null;
  return (
    <div
      data-overlay
      aria-busy="true"
      role="status"
      aria-live="polite"
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-gradient-to-b from-matur-50 to-matur-100 px-6 transition-opacity duration-300 ${keluar ? "opacity-0" : "animate-[masuk-in_.25s_ease-out]"}`}
    >
      <div className="relative">
        <div className="absolute inset-x-6 -bottom-2 h-4 animate-[bayang_1.4s_ease-in-out_infinite] rounded-full bg-kopi-900/10 blur-sm" />
        <Image
          src={
            aktif.mascot ? `/mascot/${aktif.mascot}.png` : "/brand/logo-512.png"
          }
          alt=""
          width={144}
          height={144}
          priority
          className="relative animate-[melayang_1.4s_ease-in-out_infinite] rounded-3xl"
        />
      </div>
      <p className="mt-6 max-w-sm text-center text-lg font-bold leading-relaxed text-kopi-900">
        {aktif.label}
      </p>
      {lambat && (
        <div className="mt-3 max-w-xs text-center text-sm text-stone-600">
          <p>Proses lebih lama dari biasanya. Periksa koneksi internet kamu.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-3 rounded-xl border border-matur-300 bg-white px-4 py-2 font-semibold text-kopi-900"
          >
            Muat ulang halaman
          </button>
        </div>
      )}
      <div
        aria-hidden="true"
        className="mt-4 h-1.5 w-48 overflow-hidden rounded-full bg-matur-200"
      >
        <div className="h-full w-1/3 animate-[jalan_1.1s_ease-in-out_infinite] rounded-full bg-matur-500" />
      </div>
    </div>
  );
}
