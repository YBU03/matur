import { semuaHalaman } from "@/lib/paginasi-laporan";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { LAPORAN_COLS, type Laporan } from "@/lib/laporan";
import { RekapLaporan } from "./view";
import type { Bayar } from "@/lib/laporan-rekap";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    outlet?: string;
    dari?: string;
    sampai?: string;
    tahun?: string;
  }>;
}) {
  const s = await getSession();
  if (
    !s?.active ||
    !["owner", "admin_pusat", "finance", "mitra", "manajer_area"].includes(
      s.active.role,
    )
  )
    notFound();
  const db = await supabaseServer();
  const sp = await searchParams;
  const all = await semuaHalaman<Laporan>((a, b) =>
    db
      .from("laporan_bulanan")
      .select(LAPORAN_COLS)
      .eq("mode", "asli")
      .is("deleted_at", null)
      .order("periode")
      .order("id")
      .range(a, b),
  );
  const outlets = [
    ...new Map(
      all.map((l) => [l.outlet_id, { id: l.outlet_id, nama: l.nama_outlet }]),
    ).values(),
  ];
  const valid = (v: string | undefined) =>
    v && /^\d{4}-(0[1-9]|1[0-2])$/.test(v) ? v : "";
  const tahun = /^\d{4}$/.test(sp.tahun ?? "") ? sp.tahun! : "";
  const dari = valid(sp.dari) || (tahun ? `${tahun}-01` : ""),
    sampai = valid(sp.sampai) || (tahun ? `${tahun}-12` : "");
  if (dari && sampai && dari > sampai)
    return <p role="alert">Bulan awal harus sebelum bulan akhir.</p>;
  const list = all.filter(
    (l) =>
      (!sp.outlet || l.outlet_id === sp.outlet) &&
      (!dari || l.periode.slice(0, 7) >= dari) &&
      (!sampai || l.periode.slice(0, 7) <= sampai),
  );
  const ids = list.map((l) => l.id);
  const pay: Bayar[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    pay.push(
      ...(await semuaHalaman<Bayar>((a, b) =>
        db
          .from("laporan_bayar")
          .select("*")
          .in("laporan_id", chunk)
          .order("created_at")
          .order("id")
          .range(a, b),
      )),
    );
  }
  // New outlets are included even before their first official report, under existing outlet RLS.
  const { data: os, error: oe } = await db
    .from("outlet")
    .select("id,nama")
    .eq("mode", "asli")
    .is("deleted_at", null)
    .order("nama");
  if (oe) throw new Error(oe.message);
  return (
    <RekapLaporan
      list={list}
      bayar={(pay ?? []) as Bayar[]}
      outlets={os ?? outlets}
      outlet={sp.outlet ?? ""}
      dari={dari}
      sampai={sampai}
      tahun={tahun}
    />
  );
}
