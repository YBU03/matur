import { notFound } from "next/navigation";
import { PilihOutlet } from "@/components/pilih-outlet";
import { formatRupiah } from "@/lib/format";
import { hitung, LAPORAN_COLS, namaBulan, type Laporan } from "@/lib/laporan";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

// Rekap transfer bagi hasil & sewa ke mitra/investor, diambil dari laporan bulanan yang sudah terbit.
export default async function TransferMitra({ searchParams }: { searchParams: Promise<{ outlet?: string }> }) {
  const s = await getSession();
  if (!s?.active || !["owner", "admin_pusat", "finance"].includes(s.active.role)) notFound();
  const supabase = await supabaseServer();
  const [{ data: outlets }, { data: rows }] = await Promise.all([
    supabase.from("outlet").select("id, nama").eq("mode", "asli").is("deleted_at", null).order("tgl_mulai"),
    supabase.from("laporan_bulanan").select(LAPORAN_COLS).eq("mode", "asli").is("deleted_at", null).order("periode", { ascending: false }),
  ]);
  const semua = (rows ?? []) as unknown as Laporan[];
  const daftar = outlets ?? [];
  const pilih = (await searchParams).outlet ?? daftar.find((o) => semua.some((l) => l.outlet_id === o.id))?.id ?? daftar[0]?.id;
  const list = semua.filter((l) => l.outlet_id === pilih);
  // total per penerima sepanjang waktu
  const per = new Map<string, { nama: string; rek: string; total: number; bulan: number }>();
  for (const l of list)
    for (const t of l.transfer) {
      const k = t.atas_nama || t.keterangan;
      const x = per.get(k) ?? { nama: k, rek: [t.bank, t.no_rekening].filter(Boolean).join(" "), total: 0, bulan: 0 };
      x.total += Number(t.jumlah);
      x.bulan += 1;
      per.set(k, x);
    }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Transfer Mitra</h1>
        <p className="text-sm text-stone-500">Daftar transfer bagi hasil & sewa dari setiap laporan bulanan yang sudah terbit.</p>
      </div>
      <PilihOutlet outlets={daftar} pilih={pilih} href={(id) => `/transfer?outlet=${id}`} />
      {list.length === 0 ? (
        <p className="rounded-2xl border border-matur-200 bg-white p-8 text-center text-sm text-stone-400">Belum ada laporan terbit untuk outlet ini.</p>
      ) : (
        <>
          <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {[...per.values()].map((p) => (
              <div key={p.nama} className="rounded-2xl border border-matur-200 bg-white p-3">
                <p className="truncate font-semibold">{p.nama}</p>
                <p className="text-xs text-stone-500">{p.rek || "rekening belum diisi"}</p>
                <p className="mt-1 text-lg font-bold tabular-nums">{formatRupiah(p.total)}</p>
                <p className="text-xs text-stone-500">total {p.bulan} bulan</p>
              </div>
            ))}
          </section>
          {list.map((l) => {
            const h = hitung(l);
            return (
              <section key={l.id} className="rounded-2xl border border-matur-200 bg-white p-4">
                <div className="mb-2 flex flex-wrap items-baseline gap-2">
                  <h2 className="mr-auto font-bold">{namaBulan(l.periode)}</h2>
                  <span className="text-xs text-stone-500">laba bersih {formatRupiah(h.labaBersih)}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs text-stone-500">
                      <tr>
                        <th className="py-1">Keterangan</th>
                        <th>Rekening</th>
                        <th className="text-right">Jumlah</th>
                      </tr>
                    </thead>
                    <tbody>
                      {l.transfer.map((t, i) => (
                        <tr key={i} className="border-t">
                          <td className="py-1.5">{t.keterangan}</td>
                          <td className="whitespace-nowrap text-xs text-stone-600">{[t.bank, t.no_rekening, t.atas_nama && `a.n. ${t.atas_nama}`].filter(Boolean).join(" · ") || "-"}</td>
                          <td className="text-right font-semibold tabular-nums">{formatRupiah(Number(t.jumlah))}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 font-bold">
                        <td className="py-1.5" colSpan={2}>Total transfer</td>
                        <td className="text-right tabular-nums">{formatRupiah(h.totalTransfer)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}
