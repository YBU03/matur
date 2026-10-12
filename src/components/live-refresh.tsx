"use client";

// Muat ulang data halaman otomatis saat ada perubahan di database (Supabase Realtime),
// dengan cadangan pengecekan berkala bila koneksi realtime tidak tersedia.

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

export type Pantau = { table: string; filter?: string };

export function LiveRefresh({ pantau, cadanganDetik = 30 }: { pantau: Pantau[]; cadanganDetik?: number }) {
  const router = useRouter();
  const key = JSON.stringify(pantau);
  useEffect(() => {
    const sb = supabaseBrowser();
    let t: ReturnType<typeof setTimeout> | undefined;
    const segarkan = () => {
      clearTimeout(t);
      t = setTimeout(() => router.refresh(), 400); // gabungkan beberapa perubahan beruntun
    };
    const ch = sb.channel(`live-${Math.random().toString(36).slice(2)}`);
    for (const p of JSON.parse(key) as Pantau[]) {
      ch.on("postgres_changes", { event: "*", schema: "public", table: p.table, ...(p.filter ? { filter: p.filter } : {}) }, segarkan);
    }
    ch.subscribe();
    const poll = setInterval(() => document.visibilityState === "visible" && router.refresh(), cadanganDetik * 1000);
    const fokus = () => document.visibilityState === "visible" && router.refresh();
    document.addEventListener("visibilitychange", fokus);
    return () => {
      clearTimeout(t);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", fokus);
      sb.removeChannel(ch);
    };
  }, [key, cadanganDetik, router]);
  return null;
}
