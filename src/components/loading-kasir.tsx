"use client";
import Image from "next/image";

/** Layar loading penuh saat masuk/membuka shift di tablet POS. */
export function LoadingKasir({
  teks = "Masuk sebagai kasir…",
}: {
  teks?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-5 bg-white/90 backdrop-blur-sm"
    >
      <div className="relative h-28 w-28">
        <span className="absolute inset-0 animate-spin rounded-full border-4 border-matur-100 border-t-matur-500" />
        <span className="absolute inset-3 animate-ping rounded-full bg-matur-100/70" />
        <Image
          src="/brand/logo-192.png"
          alt=""
          width={64}
          height={64}
          className="absolute inset-0 m-auto animate-bounce rounded-2xl shadow-lg"
        />
      </div>
      <p className="text-lg font-bold text-kopi-900">{teks}</p>
      <div className="flex gap-1.5">
        {[0, 150, 300].map((d) => (
          <span
            key={d}
            className="h-2.5 w-2.5 animate-bounce rounded-full bg-matur-500"
            style={{ animationDelay: `${d}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
