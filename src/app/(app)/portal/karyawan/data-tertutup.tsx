"use client";

// No. WA / alamat tertutup; ketuk ikon mata untuk melihat selama 10 detik, lalu tertutup lagi otomatis.
import { Copy, Eye, EyeOff, MapPin, MessageCircle } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { bukaDataKaryawan } from "@/lib/mitra-karyawan-actions";

const DETIK = 10;
const keWa = (n: string) => {
  const d = n.replace(/\D/g, "");
  return d.startsWith("0") ? "62" + d.slice(1) : d.startsWith("62") ? d : d;
};

export function DataTertutup({ id, jenis, samaran }: { id: string; jenis: "wa" | "alamat"; samaran: string | null }) {
  const wa = jenis === "wa";
  const [nomor, setNomor] = useState<string | null>(null);
  const [sisa, setSisa] = useState(0);
  const [pesan, setPesan] = useState("");
  const [tersalin, setTersalin] = useState(false);
  const [pending, mulai] = useTransition();
  useEffect(() => {
    if (!nomor) return;
    if (sisa <= 0) {
      setNomor(null);
      setTersalin(false);
      return;
    }
    const t = setTimeout(() => setSisa((x) => x - 1), 1000);
    return () => clearTimeout(t);
  }, [nomor, sisa]);
  if (!samaran) return <p className="px-1 text-xs text-stone-400">{wa ? "No. WA belum diisi" : "Alamat belum diisi"}</p>;
  const buka = () =>
    mulai(async () => {
      setPesan("");
      const r = await bukaDataKaryawan(id, jenis);
      if (r.ok) {
        setNomor(r.isi);
        setSisa(DETIK);
      } else setPesan(r.pesan);
    });
  const tutup = () => setSisa(0);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 rounded-xl bg-stone-50 px-2.5 py-1.5 ring-1 ring-stone-200">
        {wa ? <span className="text-[11px] font-semibold text-stone-500">WA</span> : <MapPin size={13} className="shrink-0 text-stone-400" aria-label="Alamat" />}
        <span className={`min-w-0 flex-1 ${wa ? "truncate font-mono text-sm tabular-nums" : "break-words text-xs leading-snug"} ${nomor ? "font-bold text-kopi-900" : "tracking-wider text-stone-500"}`} aria-live="polite">
          {nomor ?? samaran}
        </span>
        {nomor ? (
          <button type="button" onClick={tutup} aria-label={wa ? "Tutup nomor" : "Tutup alamat"} className="relative grid size-8 place-items-center rounded-lg text-matur-700 hover:bg-white">
            <svg viewBox="0 0 32 32" className="absolute inset-0 size-8 -rotate-90" aria-hidden>
              <circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" strokeOpacity=".15" strokeWidth="2.5" />
              <circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray={81.7} strokeDashoffset={81.7 * (1 - sisa / DETIK)} className="transition-[stroke-dashoffset] duration-1000 ease-linear" />
            </svg>
            <EyeOff size={15} />
          </button>
        ) : (
          <button type="button" onClick={buka} disabled={pending} aria-label={wa ? "Lihat nomor WA selama 10 detik" : "Lihat alamat selama 10 detik"} title="Lihat 10 detik" className="grid size-8 place-items-center rounded-lg text-kopi-700 hover:bg-white disabled:opacity-50">
            {pending ? <span className="size-4 animate-spin rounded-full border-2 border-matur-200 border-t-matur-600" /> : <Eye size={16} />}
          </button>
        )}
      </div>
      {nomor && (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(nomor).then(() => setTersalin(true)).catch(() => {})}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-stone-200 bg-white py-1.5 text-[11px] font-semibold text-kopi-700 hover:border-matur-300"
          >
            <Copy size={12} /> {tersalin ? "Tersalin" : "Salin"}
          </button>
          {wa && <a
            href={`https://wa.me/${keWa(nomor)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-600 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-700"
          >
            <MessageCircle size={12} /> Chat WA
          </a>}
          <span className="w-9 text-right text-[10px] font-semibold tabular-nums text-stone-500">{sisa}s</span>
        </div>
      )}
      {pesan && <p className="text-[11px] text-red-600">{pesan}</p>}
    </div>
  );
}
