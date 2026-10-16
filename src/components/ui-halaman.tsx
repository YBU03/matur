import type { ReactNode } from "react";

// Komponen tampilan bersama untuk halaman dashboard: header berwarna, kartu angka, kartu, badge, tab, tabel, kosong.

export function HeaderHalaman({
  judul,
  keterangan,
  ikon,
  aksi,
  children,
}: {
  judul: string;
  keterangan?: ReactNode;
  ikon?: string;
  /** tombol/tautan di kanan */
  aksi?: ReactNode;
  /** isi tambahan di bawah judul (badge, filter ringkas) */
  children?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-matur-400 via-matur-500 to-orange-600 p-5 text-white shadow-md sm:p-6">
      <span className="pointer-events-none absolute -right-10 -top-12 size-40 rounded-full bg-white/10" aria-hidden />
      <span className="pointer-events-none absolute -bottom-16 right-24 size-32 rounded-full bg-white/10" aria-hidden />
      <div className="relative flex flex-wrap items-start gap-4">
        {ikon && <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/20 text-2xl backdrop-blur">{ikon}</span>}
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{judul}</h1>
          {keterangan && <p className="mt-1 max-w-2xl text-sm text-white/90">{keterangan}</p>}
          {children && <div className="mt-3 flex flex-wrap items-center gap-2">{children}</div>}
        </div>
        {aksi && <div className="flex flex-wrap items-center gap-2">{aksi}</div>}
      </div>
    </section>
  );
}

/** tombol di dalam HeaderHalaman */
export const tombolHeader = "inline-flex items-center gap-1.5 rounded-xl bg-white/20 px-3 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-white/30";
export const tombolHeaderUtama = "inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-sm font-bold text-matur-700 shadow-sm hover:bg-matur-50";

/** chip info di dalam HeaderHalaman */
export function ChipHeader({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur">{children}</span>;
}

type Nada = "netral" | "hijau" | "kuning" | "merah" | "biru" | "ungu";
const WARNA_ANGKA: Record<Nada, string> = {
  netral: "bg-matur-50 text-matur-700",
  hijau: "bg-emerald-50 text-emerald-700",
  kuning: "bg-amber-50 text-amber-700",
  merah: "bg-red-50 text-red-700",
  biru: "bg-sky-50 text-sky-700",
  ungu: "bg-violet-50 text-violet-700",
};

export function KartuAngka({ label, nilai, ikon, sub, nada = "netral" }: { label: string; nilai: ReactNode; ikon?: string; sub?: ReactNode; nada?: Nada }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-matur-100 bg-white p-4 shadow-sm">
      {ikon && <span className={`grid size-10 shrink-0 place-items-center rounded-xl text-lg ${WARNA_ANGKA[nada]}`}>{ikon}</span>}
      <div className="min-w-0">
        <p className="text-xs font-medium text-stone-500">{label}</p>
        <p className="truncate text-xl font-extrabold tabular-nums text-kopi-900">{nilai}</p>
        {sub && <p className="text-xs text-stone-500">{sub}</p>}
      </div>
    </div>
  );
}

export function BarisAngka({ children }: { children: ReactNode }) {
  return <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</section>;
}

export function Kartu({ judul, keterangan, aksi, children, className = "" }: { judul?: ReactNode; keterangan?: ReactNode; aksi?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-matur-100 bg-white p-4 shadow-sm sm:p-5 ${className}`}>
      {(judul || aksi) && (
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            {judul && <h2 className="text-base font-bold text-kopi-900">{judul}</h2>}
            {keterangan && <p className="text-xs text-stone-500">{keterangan}</p>}
          </div>
          {aksi}
        </div>
      )}
      {children}
    </section>
  );
}

const WARNA_BADGE: Record<Nada, string> = {
  netral: "bg-stone-100 text-stone-700",
  hijau: "bg-emerald-100 text-emerald-800",
  kuning: "bg-amber-100 text-amber-800",
  merah: "bg-red-100 text-red-700",
  biru: "bg-sky-100 text-sky-800",
  ungu: "bg-violet-100 text-violet-800",
};
export function Badge({ nada = "netral", children }: { nada?: Nada; children: ReactNode }) {
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${WARNA_BADGE[nada]}`}>{children}</span>;
}

export function Kosong({ ikon = "📭", judul, children }: { ikon?: string; judul: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-matur-200 bg-white/60 px-6 py-10 text-center">
      <p className="text-4xl">{ikon}</p>
      <p className="mt-2 font-semibold text-kopi-900">{judul}</p>
      {children && <div className="mt-1 text-sm text-stone-500">{children}</div>}
    </div>
  );
}

/** kelas tabel seragam: bungkus dengan <div className={tabel.bungkus}><table className={tabel.tabel}>… */
export const tabel = {
  bungkus: "overflow-x-auto rounded-2xl border border-matur-100 bg-white shadow-sm",
  tabel: "w-full text-sm",
  kepala: "bg-matur-50 text-left text-xs font-semibold uppercase tracking-wide text-matur-800",
  th: "whitespace-nowrap px-3 py-2.5",
  baris: "border-t border-stone-100 hover:bg-matur-50/50",
  td: "px-3 py-2",
};

/** kelas isian seragam */
export const isian = "rounded-xl border border-matur-200 bg-white px-3 py-2 text-sm outline-none focus:border-matur-500 focus:ring-2 focus:ring-matur-100";

/** tab bergaya tombol (segmented) */
export const tabKelas = {
  wadah: "flex w-full gap-1 overflow-x-auto rounded-2xl bg-matur-50 p-1 text-sm font-semibold",
  aktif: "flex-1 whitespace-nowrap rounded-xl bg-white px-3 py-2 text-center text-kopi-900 shadow-sm",
  pasif: "flex-1 whitespace-nowrap rounded-xl px-3 py-2 text-center text-stone-500 hover:text-kopi-900",
};
