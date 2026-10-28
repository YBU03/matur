"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "./supabase/server";

// Simpan hasil hitung fisik (satuan pakai). Stok outlet disesuaikan dan nilai persediaan tersimpan.
export async function simpanOpname(
  outletId: string,
  tanggal: string,
  items: { bahan_id: string; qty_fisik: number; qty_sistem: number }[],
  catatan: string,
  requestId: string,
): Promise<{ error?: string; ok?: string }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal))
    return { error: "Tanggal tidak valid." };
  if (
    items.some(
      (i) =>
        !Number.isFinite(i.qty_fisik) ||
        i.qty_fisik < 0 ||
        !Number.isFinite(i.qty_sistem),
    )
  )
    return { error: "Jumlah SO tidak valid." };
  const rows = items;
  if (!rows.length) return { error: "Isi minimal satu hasil hitung." };
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("simpan_opname_terukur", {
    p: {
      outlet_id: outletId,
      tanggal,
      items: rows,
      catatan,
      request_id: requestId,
    },
  });
  if (error) return { error: error.message };
  for (const path of [
    "/stok",
    "/karyawan/stok",
    "/kasir/stok",
    "/persediaan",
    "/stok-realtime",
  ])
    revalidatePath(path);
  return {
    ok: `Opname tersimpan (${rows.length} bahan). Stok outlet sudah disesuaikan.`,
  };
}
