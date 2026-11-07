"use client";
import { useState } from "react";
import { BadgeCheck, CalendarDays, Eye, EyeOff, MapPin, Phone, UserRound } from "lucide-react";
import { formatTanggal } from "@/lib/format";
export type StafMitra = { id: string; nama: string; outlet_id: string; outlet: string; peran: string[] | null; foto_path: string | null; alamat: string | null; no_wa: string | null; tgl_masuk: string | null };
const LABEL: Record<string, string> = { spv: "SPV / Kepala Outlet", kasir: "Kasir", barista: "Barista" };

export function KartuKaryawan({ staf, foto }: { staf: StafMitra; foto?: string | null }) {
  const [lihat, setLihat] = useState(false);
  const [fotoGagal, setFotoGagal] = useState<string | null>(null);
  const nomor = staf.no_wa?.trim() ?? "";
  const digit = nomor.replace(/\D/g, "");
  const samaran = digit.length > 4 ? `•••• ${digit.slice(-4)}` : "••••••";
  const peran = staf.peran?.includes("spv") ? "spv" : staf.peran?.includes("kasir") ? "kasir" : "barista";
  return <article className="min-w-0 overflow-hidden rounded-2xl border border-matur-200 bg-white shadow-sm">
    <div className="bg-gradient-to-b from-matur-50 to-white px-3 pb-3 pt-4 text-center">
      <div className="mx-auto grid size-16 place-items-center overflow-hidden rounded-2xl bg-matur-100 ring-4 ring-white sm:size-20">
        {foto && fotoGagal !== foto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img ref={img => { if (img?.complete && !img.naturalWidth) setFotoGagal(foto ?? null); }} src={foto} alt={`Foto ${staf.nama}`} onError={() => setFotoGagal(foto ?? null)} className="size-full object-cover" />
        ) : <UserRound size={29} aria-hidden="true" className="text-matur-600" />}
      </div>
      <h3 className="mt-3 break-words text-sm font-bold text-kopi-900">{staf.nama}</h3>
      <span className="mt-1.5 inline-flex max-w-full items-center gap-1 rounded-full border border-matur-200 bg-white px-2 py-1 text-[10px] font-semibold text-matur-700"><BadgeCheck size={12} aria-hidden="true" className="shrink-0" />{LABEL[peran]}</span>
    </div>
    <dl className="space-y-3 px-3 pb-4 text-xs">
      <div className="border-t border-matur-100 pt-3">
        <dt className="flex items-center gap-1.5 text-[10px] font-semibold text-stone-500"><Phone size={12} aria-hidden="true" />No. WA</dt>
        <dd className="mt-1 flex min-w-0 items-center gap-1">
          <span className={`min-w-0 flex-1 break-all text-[11px] font-semibold tabular-nums ${nomor ? "text-kopi-900" : "text-stone-400"}`}>{nomor ? lihat ? nomor : samaran : "No. WA belum diisi"}</span>
          {nomor && <button type="button" aria-label={`${lihat ? "Sembunyikan" : "Tampilkan"} nomor WA ${staf.nama}`} aria-pressed={lihat} onClick={() => setLihat(v => !v)} className="grid size-8 shrink-0 place-items-center rounded-lg border border-matur-200 bg-matur-50 text-matur-700 transition-colors hover:bg-matur-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-matur-500">{lihat ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}</button>}
        </dd>
      </div>
      <div><dt className="flex items-center gap-1.5 text-[10px] font-semibold text-stone-500"><MapPin size={12} aria-hidden="true" />Alamat</dt><dd className="mt-1 whitespace-pre-line break-words text-[11px] leading-relaxed text-stone-600">{staf.alamat?.trim() || "Alamat belum diisi"}</dd></div>
      <div><dt className="flex items-center gap-1.5 text-[10px] font-semibold text-stone-500"><CalendarDays size={12} aria-hidden="true" />Bergabung</dt><dd className="mt-1 text-[11px] text-stone-600">{staf.tgl_masuk ? formatTanggal(staf.tgl_masuk) : "Belum diisi"}</dd></div>
    </dl>
  </article>;
}
