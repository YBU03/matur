"use client";

import { useEffect, useRef, useState } from "react";

// Kamera depan langsung (getUserMedia) untuk selfie absen, dengan jam berjalan WIB (gaya Makaryo).
export function KameraSelfie({ jenis, nama, onAmbil, onBatal, onGagal }: { jenis: "masuk" | "pulang"; nama: string; onAmbil: (f: File) => void; onBatal: () => void; onGagal: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [siap, setSiap] = useState(false);
  const [jam, setJam] = useState(new Date());

  useEffect(() => {
    let batal = false;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 960 }, height: { ideal: 960 } }, audio: false });
        if (batal) return s.getTracks().forEach((t) => t.stop());
        stream.current = s;
        if (video.current) {
          video.current.srcObject = s;
          await video.current.play();
          setSiap(true);
        }
      } catch {
        onGagal(); // izin kamera ditolak / tidak ada kamera → pakai pemilih foto biasa
      }
    })();
    const t = setInterval(() => setJam(new Date()), 1000);
    return () => {
      batal = true;
      clearInterval(t);
      stream.current?.getTracks().forEach((x) => x.stop());
    };
  }, [onGagal]);

  const jepret = () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const sisi = Math.min(v.videoWidth, v.videoHeight);
    const c = document.createElement("canvas");
    c.width = c.height = Math.min(sisi, 960);
    const ctx = c.getContext("2d")!;
    // cermin seperti pratinjau, potong persegi di tengah
    ctx.translate(c.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(v, (v.videoWidth - sisi) / 2, (v.videoHeight - sisi) / 2, sisi, sisi, 0, 0, c.width, c.height);
    c.toBlob((b) => b && onAmbil(new File([b], "selfie.jpg", { type: "image/jpeg" })), "image/jpeg", 0.85);
    stream.current?.getTracks().forEach((x) => x.stop());
  };

  const waktu = jam.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Jakarta" });
  const tanggal = jam.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
  return (
    <div className="fixed inset-0 z-[90] flex flex-col items-center justify-center gap-4 bg-kopi-900 p-4 text-white">
      <p className="text-sm text-white/70">{nama}</p>
      <p className="text-5xl font-bold tabular-nums">{waktu}</p>
      <p className="text-sm capitalize text-white/80">{tanggal} · WIB</p>
      <div className="relative aspect-square w-full max-w-sm overflow-hidden rounded-3xl bg-black">
        <video ref={video} playsInline muted className="h-full w-full -scale-x-100 object-cover" />
        <div className="pointer-events-none absolute inset-[12%] rounded-[45%] border-4 border-white/70" />
        {!siap && <p className="absolute inset-0 grid place-items-center text-sm text-white/70">Membuka kamera…</p>}
      </div>
      <p className="text-xs text-white/70">Posisikan wajah di dalam bingkai</p>
      <div className="flex w-full max-w-sm gap-2">
        <button onClick={onBatal} className="rounded-2xl border border-white/40 px-5 py-4 font-semibold">
          Batal
        </button>
        <button disabled={!siap} onClick={jepret} className={`flex-1 rounded-2xl py-4 text-lg font-bold shadow disabled:opacity-50 ${jenis === "masuk" ? "bg-green-600" : "bg-amber-600"}`}>
          {jenis === "masuk" ? "📸 Clock In" : "📸 Clock Out"}
        </button>
      </div>
    </div>
  );
}
