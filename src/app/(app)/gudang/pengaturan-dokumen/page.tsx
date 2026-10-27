import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { PengaturanDokumen } from "./view";
export default async function Page() {
  const s = await getSession();
  if (
    !s?.active ||
    !["owner", "admin_pusat", "admin_gudang"].includes(s.active.role)
  )
    notFound();
  const db = await supabaseServer();
  const { data, error } = await db
    .from("pengaturan_dokumen_gudang")
    .select("alamat,logo_path,versi,judul_ttd")
    .eq("id", true)
    .single();
  if (error || !data) throw new Error("Pengaturan dokumen belum dapat dimuat.");
  return (
    <PengaturanDokumen
      alamat={data.alamat}
      versi={data.versi}
      judul={data.judul_ttd}
      logo={
        data.logo_path
          ? "/api/gudang/logo?path=" + encodeURIComponent(data.logo_path)
          : "/brand/hazna-logo.png"
      }
    />
  );
}
