import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { OutletGudang } from "./view";
export default async function Page() {
  const s = await getSession();
  if (
    !s?.active ||
    !["owner", "admin_pusat", "admin_gudang"].includes(s.active.role)
  )
    notFound();
  const db = await supabaseServer(),
    { data, error } = await db
      .from("outlet")
      .select("id,nama,alamat,telepon,profil_versi,status")
      .eq("mode", "asli")
      .is("deleted_at", null)
      .order("nama");
  if (error) throw new Error("Data outlet belum dapat dimuat.");
  return <OutletGudang rows={data ?? []} />;
}
