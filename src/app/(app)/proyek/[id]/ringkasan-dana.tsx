import { formatRupiah } from "@/lib/format";
import type { ringkasanBelanja } from "@/lib/belanja-proyek";

export function RingkasanDana({ rab, danaMasuk, ringkas, kelolaHref }: {
  rab: number; danaMasuk: number; ringkas: ReturnType<typeof ringkasanBelanja>; kelolaHref?: string;
}) {
  const kartu = [
    { label: "Grand Total RAB", nilai: rab, sub: "Anggaran seluruh rincian RAB aktif" },
    { label: "Dana Masuk Mitra", nilai: danaMasuk, sub: "Total dana yang sudah diterima", href: kelolaHref },
    { label: "Realisasi Pembayaran", nilai: ringkas.dariProyek, sub: "DP + pelunasan dari dana proyek" },
    { label: "Sisa Dana Aktual", nilai: ringkas.saldo, sub: "Dana masuk − pembayaran dari dana proyek" },
  ];
  return <section aria-label="Ringkasan dana proyek" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
    {kartu.map(k => <div key={k.label} className="min-w-0 rounded-2xl border border-matur-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-stone-500">{k.label}</p>{k.href && <a href={k.href} className="rounded-lg border border-matur-200 px-2 py-1 text-xs font-semibold hover:bg-matur-50 focus-visible:outline-2 focus-visible:outline-matur-500">Kelola Dana</a>}</div>
      <p className={`mt-1 break-words font-bold ${k.nilai < 0 ? "text-red-600" : "text-kopi-900"}`}>{formatRupiah(k.nilai)}</p>
      <p className="mt-1 text-xs text-stone-500">{k.sub}</p>
    </div>)}
  </section>;
}
