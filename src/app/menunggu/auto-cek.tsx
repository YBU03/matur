"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

// Cek otomatis tiap 20 detik; begitu admin menyetujui, halaman langsung pindah ke dashboard
export function AutoCek() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [jam, setJam] = useState("");
  useEffect(() => {
    const cek = () => start(() => (router.refresh(), setJam(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }))));
    const id = setInterval(() => document.visibilityState === "visible" && cek(), 20000);
    return () => clearInterval(id);
  }, [router]);
  return (
    <div className="mt-4 flex flex-col items-center gap-1 text-xs text-stone-500">
      <button
        onClick={() => start(() => router.refresh())}
        disabled={pending}
        className="rounded-xl bg-matur-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Memeriksa…" : "Cek status sekarang"}
      </button>
      <span>Halaman ini memeriksa otomatis{jam && ` · terakhir ${jam}`}</span>
    </div>
  );
}
