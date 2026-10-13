import Link from "next/link";
import { notFound } from "next/navigation";
import { PilihOutlet } from "@/components/pilih-outlet";
import { formatRupiah } from "@/lib/format";
import { hitung, LAPORAN_COLS, namaBulan, type Laporan } from "@/lib/laporan";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

// Status tutup buku per bulan: sudah terbit, draft penutupan, atau belum dikerjakan.
export default async function TutupBuku({ searchParams }: { searchParams: Promise<{ outlet?: string }> }) {
  const s = await getSession();
  if (!s?.active || !["owner", "admin_pusat", "finance"].includes(s.active.role)) notFound();
  const supabase = await supabaseServer();
  const { data: outlets } = await supabase.from("outlet").select("id, nama, tgl_mulai").eq("mode", "asli").is("deleted_at", null).order("tgl_mulai");
  const daftar = outlets ?? [];
  const sp = await searchParams;
  const outlet = daftar.find((o) => o.id === sp.outlet) ?? daftar[0];
  if (!outlet) notFound();
  const [{ data: rows }, { data: draft }] = await Promise.all([
    supabase.from("laporan_bulanan").select(LAPORAN_COLS).eq("outlet_id", outlet.id).eq("mode", "asli").is("deleted_at", null),
    supabase.from("penutupan_bulan").select("periode, updated_at").eq("outlet_id", outlet.id).eq("mode", "asli"),
  ]);
  const terbit = new Map(((rows ?? []) as unknown as Laporan[]).map((l) => [l.periode.slice(0, 7), l]));
  const draf = new Set((draft ?? []).map((d) => String(d.periode).slice(0, 7)));
  // bulan dari mulai operasional (atau laporan pertama) sampai bulan ini
  const kini = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 7);
  const awal = [outlet.tgl_mulai?.slice(0, 7), ...terbit.keys()].filter(Boolean).sort()[0] ?? kini;
  const bulan: string[] = [];
  for (let d = new Date(awal + "-01T00:00:00Z"); d.toISOString().slice(0, 7) <= kini; d.setUTCMonth(d.getUTCMonth() + 1)) bulan.unshift(d.toISOString().slice(0, 7));

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Tutup Buku</h1>
        <p className="text-sm text-stone-500">Setiap akhir bulan: buka proyeksi, cek opname & ojol, simpan draft, lalu terbitkan laporan.</p>
      </div>
      <PilihOutlet outlets={daftar} pilih={outlet.id} href={(id) => `/tutup-buku?outlet=${id}`} />
      <ul className="space-y-2">
        {bulan.map((b) => {
          const l = terbit.get(b);
          const st = l ? ["✅ Terbit", "bg-green-100 text-green-800"] : draf.has(b) ? ["📝 Draft", "bg-amber-100 text-amber-800"] : b === kini ? ["⏳ Berjalan", "bg-blue-100 text-blue-800"] : ["Belum ditutup", "bg-stone-100 text-stone-600"];
          return (
            <li key={b} className="flex flex-wrap items-center gap-3 rounded-2xl border border-matur-200 bg-white p-3">
              <div className="mr-auto">
                <p className="font-semibold">{namaBulan(b + "-01")}</p>
                {l && <p className="text-xs text-stone-500">laba bersih {formatRupiah(hitung(l).labaBersih)}</p>}
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${st[1]}`}>{st[0]}</span>
              {l ? (
                <Link href={`/laporan/${l.id}`} className="rounded-lg border border-matur-300 px-3 py-1.5 text-xs font-semibold text-matur-700">Lihat laporan</Link>
              ) : (
                <Link href={`/laporan/proyeksi?outlet=${outlet.id}&bulan=${b}`} className="rounded-lg bg-kopi-900 px-3 py-1.5 text-xs font-semibold text-white">{draf.has(b) ? "Lanjutkan" : "Mulai tutup buku"}</Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
