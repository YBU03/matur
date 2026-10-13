"use client";

import { useEffect, useState } from "react";
import { simpanLanggananPush } from "@/lib/push-actions";

const kunci = (b64: string) => {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

// Tombol untuk staf: izinkan notifikasi pengingat shift di HP ini (sekali per perangkat).
export function AktifkanPush() {
  const [status, setStatus] = useState<"cek" | "tidak-didukung" | "aktif" | "belum" | "ditolak">("cek");
  const [err, setErr] = useState("");
  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return setStatus("tidak-didukung");
      if (Notification.permission === "denied") return setStatus("ditolak");
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await simpanLanggananPush(sub.toJSON() as never); // segarkan kepemilikan bila akun di HP berganti
        setStatus("aktif");
      } else setStatus("belum");
    })().catch(() => setStatus("tidak-didukung"));
  }, []);
  const aktifkan = async () => {
    setErr("");
    try {
      const izin = await Notification.requestPermission();
      if (izin !== "granted") return setStatus("ditolak");
      const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: kunci(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!) });
      const r = await simpanLanggananPush(sub.toJSON() as never);
      if (r.error) return setErr(r.error);
      setStatus("aktif");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gagal mengaktifkan notifikasi.");
    }
  };
  if (status === "cek" || status === "tidak-didukung" || status === "aktif") return null;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-matur-300 bg-matur-50 px-3 py-2 text-sm">
      <span className="flex-1">🔔 {status === "ditolak" ? "Notifikasi diblokir. Izinkan notifikasi untuk situs ini di pengaturan browser agar dapat pengingat shift." : "Aktifkan pengingat shift di HP ini (notifikasi ±1 jam sebelum shift)."}</span>
      {status === "belum" && (
        <button onClick={aktifkan} className="rounded-lg bg-matur-500 px-3 py-1.5 font-semibold text-white">
          Aktifkan
        </button>
      )}
      {err && <span className="w-full text-xs text-red-600">{err}</span>}
    </div>
  );
}
