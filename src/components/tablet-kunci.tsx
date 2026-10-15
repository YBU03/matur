"use client";
import { useEffect, useState } from "react";
import { kunciPos } from "@/lib/pos-tim-actions";

/** kunci otomatis tablet setelah 5 menit tanpa sentuhan (sama dengan layar kasir) */
const IDLE_MS = 5 * 60000;

async function kunci() {
  try {
    if (navigator.onLine) await kunciPos();
  } catch {}
  location.href = "/pos";
}

/** Pasang di halaman tablet selain layar kasir (layar kasir punya penguncinya sendiri). */
export function AutoKunci() {
  useEffect(() => {
    let last = Date.now();
    let selesai = false;
    const aktif = () => {
      last = Date.now();
    };
    const t = setInterval(() => {
      if (!selesai && Date.now() - last > IDLE_MS) {
        selesai = true;
        void kunci();
      }
    }, 5000);
    window.addEventListener("pointerdown", aktif);
    window.addEventListener("keydown", aktif);
    return () => {
      clearInterval(t);
      window.removeEventListener("pointerdown", aktif);
      window.removeEventListener("keydown", aktif);
    };
  }, []);
  return null;
}

export function TombolKunci({ besar = false }: { besar?: boolean }) {
  const [sibuk, setSibuk] = useState(false);
  return (
    <button
      disabled={sibuk}
      onClick={() => {
        setSibuk(true);
        void kunci();
      }}
      className={
        besar
          ? "flex min-h-28 flex-col items-center justify-center gap-1 rounded-3xl border-2 border-stone-200 bg-white p-4 text-lg font-bold shadow-sm active:scale-95"
          : "rounded-xl bg-kopi-900 px-3 py-2 text-sm font-bold text-white"
      }
    >
      <span className={besar ? "text-4xl" : ""}>🔒</span>{" "}
      {sibuk ? "Mengunci…" : "Kunci layar"}
    </button>
  );
}
