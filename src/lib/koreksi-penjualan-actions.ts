"use server";
import { getSession } from "./session";
import { supabaseServer } from "./supabase/server";
import { revalidatePath } from "next/cache";
import type {
  PermintaanPenjualan,
  RincianPenjualan,
  PreviewPenjualan,
} from "./koreksi-penjualan";
async function boleh() {
  return ["owner", "admin_pusat", "finance"].includes(
    (await getSession())?.active?.role ?? "",
  );
}
export async function rincianPenjualan(
  id: string,
): Promise<{ data?: RincianPenjualan; error?: string }> {
  if (!(await boleh())) return { error: "Tidak diizinkan" };
  const db = await supabaseServer();
  const { data, error } = await db.rpc("rincian_koreksi_penjualan", {
    tid: id,
  });
  return error
    ? { error: error.message }
    : data
      ? { data }
      : { error: "Transaksi tidak tersedia" };
}
export async function simpanPenjualan(
  p: PermintaanPenjualan,
): Promise<{ error?: string; ok?: string; data?: PreviewPenjualan }> {
  if (!(await boleh())) return { error: "Tidak diizinkan" };
  const db = await supabaseServer();
  const { data, error } = await db.rpc("simpan_koreksi_penjualan", { p });
  if (error) return { error: error.message };
  if (!p.pratinjau)
    for (const path of [
      "/koreksi-penjualan",
      "/catatan-harian",
      "/laporan-pos",
      "/dashboard",
      "/kasir/riwayat",
      "/stok-realtime",
    ])
      revalidatePath(path, "layout");
  return { ok: data.ok, data };
}
