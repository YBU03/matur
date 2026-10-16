"use client";
import { useEffect, useState } from "react";

/** Sisa waktu shift dengan bilah progres (diperbarui tiap menit). */
export function SisaShift({ buka, batas }: { buka: string; batas: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);
  if (now === null) return null;
  const a = Date.parse(buka);
  const b = Date.parse(batas);
  const persen = Math.min(
    100,
    Math.max(0, ((now - a) / Math.max(1, b - a)) * 100),
  );
  const sisa = Math.max(0, Math.round((b - now) / 60000));
  return (
    <div className="w-full max-w-xs text-right sm:w-64">
      <p className="text-xs opacity-90">Sisa shift</p>
      <p className="text-2xl font-bold tabular-nums">
        {Math.floor(sisa / 60)} j {sisa % 60} m
      </p>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/30">
        <div
          className="h-full rounded-full bg-white"
          style={{ width: `${persen}%` }}
        />
      </div>
    </div>
  );
}
