import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { LAPORAN_COLS, type Laporan, type Perusahaan } from "@/lib/laporan";
import { LaporanDokumen } from "../laporan-dokumen";
const BOLEH = ["owner", "admin_pusat", "finance", "manajer_area", "mitra"];

export default async function DetailLaporan({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const s = await getSession();
  if (!s?.active || !BOLEH.includes(s.active.role)) notFound();
  const supabase = await supabaseServer();
  const [{ data }, { data: pt }] = await Promise.all([
    supabase
      .from("laporan_bulanan")
      .select(LAPORAN_COLS)
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("perusahaan")
      .select("nama, alamat, email, telepon")
      .limit(1)
      .maybeSingle(),
  ]);
  if (!data) notFound();
  const l = data as unknown as Laporan;
  const { data: semua } = await supabase
    .from("laporan_bulanan")
    .select(LAPORAN_COLS)
    .eq("outlet_id", l.outlet_id)
    .eq("mode", "asli")
    .lte("periode", l.periode)
    .is("deleted_at", null)
    .order("periode");
  return (
    <LaporanDokumen
      l={l}
      pt={pt as Perusahaan | null}
      semua={(semua ?? []) as unknown as Laporan[]}
    />
  );
}
