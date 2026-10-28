import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { ArsipDokumen } from "./view";
export default async function Page() {
  const s = await getSession();
  if (
    !s?.active ||
    !["owner", "admin_pusat", "admin_gudang"].includes(s.active.role)
  )
    notFound();
  const db = await supabaseServer(),
    { data, error } = await db
      .from("dokumen_kiriman_gudang")
      .select("kiriman_id,jenis,versi,arsip_at,kiriman(nomor,outlet(nama))")
      .not("arsip_at", "is", null)
      .order("arsip_at", { ascending: false })
      .limit(200);
  if (error) throw new Error("Arsip belum dapat dimuat.");
  return (
    <ArsipDokumen
      rows={
        (data ?? []) as unknown as Parameters<typeof ArsipDokumen>[0]["rows"]
      }
    />
  );
}
