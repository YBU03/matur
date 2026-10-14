"use client";

import { useEffect, useState } from "react";
import { qrisDinamis } from "@/lib/qris";

export type QrisOutlet = { url: string | null; payload: string | null; nama: string | null; dinamis: boolean };

/** Tampilkan QRIS: dinamis (nominal sudah tertanam) bila diaktifkan, selain itu gambar QRIS yang diunggah. */
export function QrisTampil({ q, nominal, ukuran = 280 }: { q: QrisOutlet; nominal?: number; ukuran?: number }) {
  const [src, setSrc] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const pakaiDinamis = q.dinamis && !!q.payload && !!nominal && nominal > 0;
  // statis tanpa gambar: QR dibuat dari kode QRIS apa adanya (tanpa nominal)
  const dariKode = !pakaiDinamis && !q.url && !!q.payload;
  useEffect(() => {
    let aktif = true;
    if (!pakaiDinamis && !dariKode) return;
    (async () => {
      try {
        const QR = (await import("qrcode")).default;
        const url = await QR.toDataURL(pakaiDinamis ? qrisDinamis(q.payload!, nominal!) : q.payload!.trim(), { width: ukuran * 2, margin: 1, errorCorrectionLevel: "M" });
        if (aktif) setSrc(url);
      } catch (e) {
        if (aktif) setErr((e as Error).message);
      }
    })();
    return () => {
      aktif = false;
    };
  }, [pakaiDinamis, dariKode, q.payload, nominal, ukuran]);

  if ((pakaiDinamis || dariKode) && !err)
    return src ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="QRIS dengan nominal" width={ukuran} height={ukuran} className="mx-auto rounded-lg bg-white" />
    ) : (
      <div style={{ width: ukuran, height: ukuran }} className="mx-auto animate-pulse rounded-lg bg-stone-100" />
    );
  if (q.url)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={q.url} alt="QRIS" style={{ maxWidth: ukuran, maxHeight: ukuran * 1.4 }} className="mx-auto rounded-lg bg-white object-contain" />;
  return <p className="text-center text-sm text-red-600">{err || "QRIS outlet belum diatur."}</p>;
}
