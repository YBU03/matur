import { notFound } from "next/navigation";
import { LiveRefresh } from "@/components/live-refresh";
import { addDays, hariIni } from "@/lib/jadwal/waktu";
import { outletSdm, PENGELOLA_SDM } from "@/lib/sdm";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { PersetujuanView, type IzinBaris, type TukarBaris } from "./persetujuan-view";

// Antrean persetujuan izin/sakit/libur dan tukar shift untuk HRD (semua outlet) & SPV (outletnya).
export default async function PersetujuanPage() {
  const s = await getSession();
  if (!s?.active || !PENGELOLA_SDM.includes(s.active.role)) notFound();
  const outlets = await outletSdm(s);
  const ids = outlets.map((o) => o.id);
  const supabase = await supabaseServer();
  const sejak = addDays(hariIni(), -30);
  const [{ data: izin }, { data: tukar }, ...staf] = await Promise.all([
    supabase.from("pengajuan_izin").select("id, outlet_id, pengguna_id, jenis, tanggal, alasan, status, alasan_tolak, created_at").in("outlet_id", ids).or(`status.eq.menunggu,created_at.gte.${sejak}`).order("created_at", { ascending: false }).limit(200),
    supabase
      .from("tukar_shift")
      .select("id, outlet_id, pengaju_id, rekan_id, alasan, status, alasan_tolak, created_at, a:jadwal_pengaju(tanggal, shift:shift_id(nama, jam_mulai)), b:jadwal_rekan(tanggal, shift:shift_id(nama, jam_mulai))")
      .in("outlet_id", ids)
      .or(`status.in.(menunggu_rekan,menunggu_atasan),created_at.gte.${sejak}`)
      .order("created_at", { ascending: false })
      .limit(100),
    ...ids.map((id) => supabase.rpc("staf_jadwal", { p_outlet: id })),
  ]);
  const nama: Record<string, string> = {};
  const stafOutlet: Record<string, { id: string; nama: string }[]> = {};
  staf.forEach((r, i) => {
    const d = (r.data ?? []) as { id: string; nama: string }[];
    stafOutlet[ids[i]] = d.map((x) => ({ id: x.id, nama: x.nama }));
    for (const x of d) nama[x.id] = x.nama;
  });
  return (
    <>
      <LiveRefresh pantau={[{ table: "pengajuan_izin" }, { table: "tukar_shift" }]} cadanganDetik={60} />
      <PersetujuanView
        outlets={outlets.map((o) => ({ id: o.id, nama: o.nama }))}
        nama={nama}
        stafOutlet={stafOutlet}
        izin={(izin ?? []) as IzinBaris[]}
        tukar={(tukar ?? []) as unknown as TukarBaris[]}
      />
    </>
  );
}
