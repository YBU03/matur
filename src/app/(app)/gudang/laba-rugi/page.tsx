import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { LabaGudang } from "./view";
import type { GudangLaporan } from "@/lib/gudang-laporan";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    awal?: string;
    akhir?: string;
    outlet?: string;
    bahan?: string;
  }>;
}) {
  const s = await getSession();
  if (
    !s?.active ||
    !["owner", "admin_pusat", "admin_gudang", "finance"].includes(s.active.role)
  )
    notFound();
  const sp = await searchParams;
  const hari = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  const awal = sp.awal ?? hari.slice(0, 7) + "-01",
    akhir = sp.akhir ?? hari;
  const db = await supabaseServer();
  const [{ data, error }, { data: outlets }, { data: bahan }] =
    await Promise.all([
      db.rpc("laporan_laba_gudang", {
        p_awal: awal,
        p_akhir: akhir,
        p_outlet: sp.outlet || null,
        p_bahan: sp.bahan || null,
      }),
      db
        .from("outlet")
        .select("id,nama")
        .eq("mode", "asli")
        .is("deleted_at", null)
        .order("nama"),
      db
        .from("bahan")
        .select("id,nama")
        .eq("mode", "asli")
        .is("deleted_at", null)
        .order("nama"),
    ]);
  return (
    <LabaGudang
      key={[awal, akhir, sp.outlet, sp.bahan].join(":")}
      data={error ? null : (data as GudangLaporan)}
      error={error?.message ?? ""}
      awal={awal}
      akhir={akhir}
      hari={hari}
      outlet={sp.outlet ?? ""}
      bahan={sp.bahan ?? ""}
      outlets={outlets ?? []}
      daftarBahan={bahan ?? []}
      boleh={s.active.role !== "finance"}
    />
  );
}
