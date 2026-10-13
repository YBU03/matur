import Link from "next/link";
import { notFound } from "next/navigation";
import { formatRupiah } from "@/lib/format";
import { hitung, LAPORAN_COLS, namaBulan, type Laporan } from "@/lib/laporan";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

const BOLEH = ["owner", "admin_pusat", "finance", "manajer_area", "mitra"];

// Daftar laporan keuangan bulanan per outlet (data tiap outlet terpisah)
export default async function DaftarLaporan({ searchParams }: { searchParams: Promise<{ outlet?: string }> }) {
  const s = await getSession();
  if (!s?.active || !BOLEH.includes(s.active.role)) notFound();
  const supabase = await supabaseServer();
  const [{ data: outlets }, { data: rows }] = await Promise.all([
    supabase.from("outlet").select("id, nama, skema:skema_bagi_hasil(nama)").eq("mode", "asli").is("deleted_at", null).order("tgl_mulai"),
    supabase.from("laporan_bulanan").select(LAPORAN_COLS).eq("mode", "asli").is("deleted_at", null).order("periode", { ascending: false }),
  ]);
  const semua = (rows ?? []) as unknown as Laporan[];
  const daftar = outlets ?? [];
  const pilih = (await searchParams).outlet ?? daftar.find((o) => semua.some((l) => l.outlet_id === o.id))?.id ?? daftar[0]?.id;
  const list = semua.filter((l) => l.outlet_id === pilih);
  const ringkas = list.map((l) => ({ l, h: hitung(l) }));
  const total = ringkas.reduce((t, { h }) => ({ omzet: t.omzet + h.totalPenjualan, laba: t.laba + h.labaBersih, mitra: t.mitra + h.bagiMitra }), { omzet: 0, laba: 0, mitra: 0 });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Laporan Keuangan</h1>
      <div className="-mx-4 overflow-x-auto px-4">
        <div className="flex w-max gap-2">
          {daftar.length > 1 && daftar.map((o) => {
            const n = semua.filter((l) => l.outlet_id === o.id).length;
            return (
              <Link
                key={o.id}
                href={`/laporan?outlet=${o.id}`}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${o.id === pilih ? "bg-kopi-900 text-white" : "border border-matur-200 bg-white text-kopi-700"}`}
              >
                {o.nama} <span className="opacity-70">({n})</span>
              </Link>
            );
          })}
        </div>
      </div>

      {s.active.role !== "mitra" && (() => {
        const sk = (daftar.find((o) => o.id === pilih)?.skema as unknown as { nama: string } | null)?.nama;
        return (
          <p className="text-sm text-stone-500">
            Skema bagi hasil: <b className="text-kopi-900">{sk ?? "belum dipilih"}</b> ·{" "}
            <Link href="/skema-bagi-hasil" className="text-matur-700 underline">atur</Link>
          </p>
        );
      })()}

      {list.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-matur-300 bg-white p-6 text-center text-stone-500">Belum ada laporan untuk outlet ini.</p>
      ) : (
        <>
          <section className="grid grid-cols-3 gap-2 sm:gap-3">
            {[
              ["Total penjualan", total.omzet],
              ["Total laba bersih", total.laba],
              ["Bagi hasil mitra", total.mitra],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl border border-matur-200 bg-white p-3">
                <p className="text-xs text-stone-500">{k}</p>
                <p className="text-sm font-bold sm:text-lg">{formatRupiah(Number(v))}</p>
                <p className="text-[11px] text-stone-400">{list.length} bulan</p>
              </div>
            ))}
          </section>
          <ul className="space-y-2">
            {ringkas.map(({ l, h }) => (
              <li key={l.id}>
                <Link href={`/laporan/${l.id}`} className="flex items-center gap-3 rounded-2xl border border-matur-200 bg-white p-4 hover:bg-matur-50">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{namaBulan(l.periode)}</p>
                    <p className="text-xs text-stone-500">
                      Penjualan {formatRupiah(h.totalPenjualan)} · Bagi hasil mitra {formatRupiah(h.bagiMitra)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-stone-500">Laba bersih</p>
                    <p className="font-bold text-green-700">{formatRupiah(h.labaBersih)}</p>
                  </div>
                  <span className="text-stone-400">›</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
