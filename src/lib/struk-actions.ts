"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "./session";
import { supabaseServer } from "./supabase/server";
import type { StrukOutlet } from "./struk";

export type Result = { error?: string; ok?: string };

/** Simpan isi struk satu outlet. Owner / Admin Pusat / Admin Gudang. */
export async function simpanStruk(outletId: string, d: StrukOutlet): Promise<Result> {
  const r = (await getSession())?.active?.role;
  if (!r || !["owner", "admin_pusat", "admin_gudang"].includes(r)) return { error: "Hanya Owner / Admin Pusat / Admin Gudang." };
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("atur_struk_outlet", { p: { outlet_id: outletId, ...d } });
  if (error) return { error: error.message.replace(/^.*?ERROR:\s*/, "") };
  revalidatePath("/pengaturan/struk");
  revalidatePath("/kasir/pos");
  revalidatePath("/kasir/riwayat");
  return { ok: "Pengaturan struk disimpan. Berlaku untuk struk berikutnya." };
}
