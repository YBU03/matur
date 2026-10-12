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
const MAX_MS = 20000;

export const mulaiMasuk = (info: Info) => window.dispatchEvent(new CustomEvent(MULAI, { detail: info }));
export const batalMasuk = () => window.dispatchEvent(new Event(SELESAI));

export function MasukOverlay() {
  const pathname = usePathname();
  const [aktif, setAktif] = useState<(Info & { dari: string; t: number }) | null>(null);
  const [keluar, setKeluar] = useState(false);

  useEffect(() => {
    const mulai = (e: Event) => {
      setKeluar(false);
      setAktif({ ...(e as CustomEvent<Info>).detail, dari: window.location.pathname, t: Date.now() });
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
    const id = setInterval(() => {
      const lama = Date.now() - aktif.t;
      const siap = pathname !== aktif.dari && pathname !== "/masuk" && !document.querySelector('[aria-busy="true"]:not([data-overlay])');
      if ((siap && lama >= MIN_MS) || lama > MAX_MS) {
        clearInterval(id);
        setKeluar(true);
        setTimeout(() => setAktif(null), 300);
      }
    }, 100);
    return () => clearInterval(id);
  }, [aktif, pathname]);

  if (!aktif) return null;
  return (
    <div
      data-overlay
      aria-busy="true"
      role="status"
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-gradient-to-b from-matur-50 to-matur-100 px-6 transition-opacity duration-300 ${keluar ? "opacity-0" : "animate-[masuk-in_.25s_ease-out]"}`}
    >
      <div className="relative">
        <div className="absolute inset-x-6 -bottom-2 h-4 animate-[bayang_1.4s_ease-in-out_infinite] rounded-full bg-kopi-900/10 blur-sm" />
        <Image
          src={aktif.mascot ? `/mascot/${aktif.mascot}.png` : "/brand/logo-512.png"}
          alt=""
          width={160}
          height={160}
          priority
          className="relative animate-[melayang_1.4s_ease-in-out_infinite] rounded-3xl"
        />
      </div>
      <Image src="/brand/logo-192.png" alt="Matoer" width={44} height={44} className="mt-8 rounded-xl" />
      <p className="mt-3 text-center font-semibold text-kopi-900">{aktif.label}</p>
      <div className="mt-4 h-1.5 w-48 overflow-hidden rounded-full bg-matur-200">
        <div className="h-full w-1/3 animate-[jalan_1.1s_ease-in-out_infinite] rounded-full bg-matur-500" />
      </div>
    </div>
  );
}
