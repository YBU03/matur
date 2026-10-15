// Primitif tampilan aplikasi staf (kasir & barista), mengikuti bentuk kartu Makaryo dengan warna Matoer.
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export function Kartu({ className, ...p }: ComponentProps<"div">) {
  return <div className={cx("rounded-[var(--radius-kartu)] border border-garis bg-white p-5 shadow-[var(--shadow-kartu)] sm:p-6", className)} {...p} />;
}

export function KepalaKartu({ judul, keterangan, aksi }: { judul: ReactNode; keterangan?: ReactNode; aksi?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-kopi-900">{judul}</h2>
        {keterangan && <p className="mt-0.5 text-[13px] text-redup">{keterangan}</p>}
      </div>
      {aksi && <div className="shrink-0">{aksi}</div>}
    </div>
  );
}

export function JudulHalaman({ judul, keterangan, aksi }: { judul: string; keterangan?: string; aksi?: ReactNode }) {
  return (
    <header className="mb-5 flex items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-kopi-900 lg:text-2xl">{judul}</h1>
        {keterangan && <p className="mt-0.5 text-[13px] text-redup">{keterangan}</p>}
      </div>
      {aksi}
    </header>
  );
}

const NADA_SOFT = {
  oranye: "bg-matur-100 text-matur-700",
  kopi: "bg-[#f3e6da] text-kopi-700",
  hijau: "bg-emerald-50 text-emerald-700",
  kuning: "bg-amber-50 text-amber-700",
  merah: "bg-red-50 text-red-600",
  netral: "bg-stone-100 text-stone-500",
};
export type Nada = keyof typeof NADA_SOFT;

export function KartuAngka({ label, nilai, ikon: Ikon, nada = "netral", catatan }: { label: string; nilai: ReactNode; ikon?: LucideIcon; nada?: Nada; catatan?: ReactNode }) {
  return (
    <div className="rounded-[var(--radius-kartu)] border border-garis bg-white p-4 shadow-[var(--shadow-kartu)] sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12px] font-semibold text-redup">{label}</p>
        {Ikon && (
          <span className={cx("inline-flex size-8 shrink-0 items-center justify-center rounded-full", NADA_SOFT[nada])}>
            <Ikon className="size-4" aria-hidden />
          </span>
        )}
      </div>
      <p className="tabular mt-2 text-[22px] font-bold leading-none text-kopi-900 sm:text-[28px]">{nilai}</p>
      {catatan && <p className="mt-1.5 text-[12px] text-redup">{catatan}</p>}
    </div>
  );
}

const NADA_PENUH = {
  oranye: "bg-gradient-to-br from-matur-500 to-matur-700 text-white",
  kopi: "bg-gradient-to-br from-kopi-700 to-kopi-900 text-white",
  hijau: "bg-gradient-to-br from-emerald-500 to-emerald-700 text-white",
  merah: "bg-gradient-to-br from-red-500 to-red-700 text-white",
};

/** Kartu modul berwarna penuh di beranda. */
export function KartuModul({ href, judul, keterangan, ikon: Ikon, nada = "oranye", badge }: { href: string; judul: string; keterangan?: string; ikon: LucideIcon; nada?: keyof typeof NADA_PENUH; badge?: number }) {
  return (
    <Link href={href} className={cx("relative flex min-h-[124px] flex-col justify-between overflow-hidden rounded-[var(--radius-kartu)] p-4 transition-transform hover:-translate-y-0.5 motion-reduce:transition-none sm:p-5", NADA_PENUH[nada])}>
      <span className="inline-flex size-10 items-center justify-center rounded-full bg-white/20">
        <Ikon className="size-5" aria-hidden />
      </span>
      {!!badge && <span className="absolute right-4 top-4 rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-red-600">{badge}</span>}
      <span className="mt-3 block">
        <span className="block text-[15px] font-bold leading-tight">{judul}</span>
        {keterangan && <span className="mt-0.5 block text-[12px] text-white/80">{keterangan}</span>}
      </span>
    </Link>
  );
}

const LENCANA = {
  hijau: "bg-emerald-50 text-emerald-700",
  kuning: "bg-amber-50 text-amber-800",
  merah: "bg-red-50 text-red-600",
  oranye: "bg-matur-100 text-matur-700",
  netral: "bg-stone-100 text-stone-600",
  ungu: "bg-violet-50 text-violet-700",
};
export function Lencana({ nada = "netral", children, className }: { nada?: keyof typeof LENCANA; children: ReactNode; className?: string }) {
  return <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold", LENCANA[nada], className)}>{children}</span>;
}

export function Kosong({ ikon: Ikon, judul, keterangan }: { ikon: LucideIcon; judul: string; keterangan?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl bg-krem px-4 py-8 text-center">
      <Ikon className="size-6 text-redup" aria-hidden />
      <p className="text-sm font-semibold text-kopi-900">{judul}</p>
      {keterangan && <p className="text-[13px] text-redup">{keterangan}</p>}
    </div>
  );
}

export const tombol = {
  utama: "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-matur-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-matur-700 disabled:opacity-50",
  lembut: "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-matur-100 px-5 py-2.5 text-sm font-bold text-matur-700 hover:bg-matur-200 disabled:opacity-50",
  garis: "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-garis bg-white px-5 py-2.5 text-sm font-semibold text-kopi-900 hover:bg-krem disabled:opacity-50",
  bahaya: "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-red-200 bg-white px-5 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50",
};
export const masukan = "mt-1 block w-full rounded-2xl border border-garis bg-white px-4 py-3 text-[15px] text-kopi-900 outline-none focus:border-matur-500 focus:ring-2 focus:ring-matur-200";

export function Pesan({ hasil }: { hasil: { error?: string; ok?: string } | null }) {
  if (!hasil || (!hasil.error && !hasil.ok)) return null;
  return <p className={cx("rounded-2xl px-4 py-3 text-sm font-medium", hasil.error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800")}>{hasil.error ?? hasil.ok}</p>;
}

export function Avatar({ nama, besar }: { nama: string; besar?: boolean }) {
  const inisial = nama
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((k) => k[0]!.toUpperCase())
    .join("");
  return <span className={cx("inline-flex shrink-0 items-center justify-center rounded-full bg-matur-100 font-bold text-matur-700", besar ? "size-16 text-xl" : "size-9 text-sm")}>{inisial || "?"}</span>;
}
