"use server";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "./supabase/server";
export async function gudangRpc(
  fn:
    | "atur_harga_jual_gudang"
    | "atur_pemeriksa_kiriman"
    | "proses_opname_gudang"
    | "proses_biaya_gudang",
  args: Record<string, unknown>,
) {
  if(!["atur_harga_jual_gudang","atur_pemeriksa_kiriman","proses_opname_gudang","proses_biaya_gudang"].includes(fn))return {error:"Aksi tidak dikenal."};
  const db = await supabaseServer();
  const { data, error } = await db.rpc(fn, args);
  if (error) return { error: error.message };
  for (const path of [
    "/gudang/stok",
    "/gudang/opname",
    "/gudang/laba-rugi",
    "/gudang/kiriman",
    "/operasional/kiriman",
  ])
    revalidatePath(path);
  return { id: typeof data === "string" ? data : undefined, ok: "Tersimpan." };
}
