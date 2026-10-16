import Link from "next/link";
import { formatRupiah, formatTanggal } from "@/lib/format";
import type { Ringkasan } from "@/lib/proyek";

export function Progress({ value, className = "" }: { value: number; className?: string }) {
  return (
    <div className={`h-2.5 overflow-hidden rounded-full bg-matur-100 ${className}`}>
      <div className="h-full rounded-full bg-gradient-to-r from-matur-400 to-matur-600" style={{ width: `${value}%` }} />
    </div>
  );
}

export const sisaHari = (iso: string | null) => (iso ? Math.ceil((new Date(iso + "T00:00:00").getTime() - Date.now()) / 86400000) : null);

export function ProyekCard({ p }: { p: Ringkasan }) {
  const hari = sisaHari(p.target_buka);
  return (
    <Link href={`/proyek/${p.id}`} className="block rounded-2xl border border-matur-200 bg-white p-4 shadow-sm hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold">{p.nama}</p>
          <p className="text-sm text-stone-500">{p.outlet?.nama}</p>
        </div>
        <span className="text-2xl font-extrabold text-matur-600">{p.progres}%</span>
      </div>
      <Progress value={p.progres} className="my-3" />
      <div className="grid grid-cols-2 gap-1 text-xs text-stone-600">
        <span>Grand Total RAB {formatRupiah(p.estimasiRab)}</span>
        <span className="text-right">Realisasi {formatRupiah(p.realisasi)}</span>
        <span>{p.target_buka ? `Target buka ${formatTanggal(p.target_buka)}` : "Target buka belum diatur"}</span>
        <span className="text-right">{p.status === "selesai" ? "Selesai ✅" : hari !== null ? (hari >= 0 ? `${hari} hari lagi` : `lewat ${-hari} hari`) : ""}</span>
      </div>
    </Link>
  );
}
