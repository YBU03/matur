import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { type Laporan, type Perusahaan } from "@/lib/laporan";
import { LaporanDokumen } from "../laporan-dokumen";
export default async function PreviewInternal({
  searchParams,
}: {
  searchParams: Promise<{ outlet?: string; bulan?: string }>;
}) {
  const s = await getSession();
  if (
    !s?.active ||
    !["owner", "admin_pusat", "finance"].includes(s.active.role)
  )
    notFound();
  const q = await searchParams;
  if (!q.outlet || !/^\d{4}-\d{2}$/.test(q.bulan ?? "")) notFound();
  const db = await supabaseServer();
  const [{ data: d }, { data: pt }] = await Promise.all([
    db
      .from("laporan_internal")
      .select("snapshot")
      .eq("outlet_id", q.outlet)
      .eq("periode", q.bulan + "-01")
      .maybeSingle(),
    db
      .from("perusahaan")
      .select("nama,alamat,email,telepon")
      .limit(1)
      .maybeSingle(),
  ]);
  if (!d?.snapshot)
    redirect(`/laporan/proyeksi?outlet=${q.outlet}&bulan=${q.bulan}`);
  return (
    <LaporanDokumen
      l={d.snapshot as Laporan}
      pt={pt as Perusahaan | null}
      internal
    />
  );
}
