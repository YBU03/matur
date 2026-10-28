import "server-only";
import type { Kop } from "./pdf-kop";
import type { supabaseServer } from "./supabase/server";
export async function kopGudang(
  db: Awaited<ReturnType<typeof supabaseServer>>,
  pt: Kop,
): Promise<Kop> {
  const { data, error } = await db
    .from("pengaturan_dokumen_gudang")
    .select("alamat,logo_path,judul_ttd,telepon")
    .eq("id", true)
    .single();
  if (error || !data)
    throw new Error("Pengaturan dokumen gudang belum dapat dimuat.");
  return {
    ...pt,
    alamat: data.alamat,
    telepon: data.telepon,
    judul_ttd: data.judul_ttd,
    logo_url: data.logo_path
      ? "/api/gudang/logo?path=" + encodeURIComponent(data.logo_path)
      : "/brand/hazna-logo.png",
  };
}
