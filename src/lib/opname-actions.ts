"use server";

import { revalidatePath } from "next/cache";
import { konflikSo } from "./so-draft";
import { supabaseServer } from "./supabase/server";

// Simpan hasil hitung fisik (satuan pakai). Stok outlet disesuaikan dan nilai persediaan tersimpan.
export async function simpanOpname(
  outletId: string,
  tanggal: string,
  items: { bahan_id: string; qty_fisik: number; qty_sistem: number }[],
  catatan: string,
  requestId: string,
): Promise<{ error?: string; ok?: string; id?: string; konflik?: { bahan_id: string; qty_sistem: number; qty_fisik: number; qty_terbaru: number }[] }> {
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
  const { data, error } = await supabase.rpc("simpan_opname_terukur", {
    p: {
      outlet_id: outletId,
      tanggal,
      items: rows,
      catatan,
      request_id: requestId,
    },
  });
  if (error) {
    if (!error.code) throw new Error("Jawaban server belum pasti; ulangi dengan request yang sama.");
    if (error.message.includes("Stok berubah")) {
      const stok = await bacaStokSo(outletId);
      return { error: "Ada stok berubah. Hitung ulang hanya bahan yang ditandai, lalu simpan lagi.", konflik: stok.stok ? konflikSo(rows, stok.stok) : undefined };
    }
    return { error: error.message };
  }
  if (!data) throw new Error("Nomor bukti belum diterima. Coba simpan lagi dengan isian yang sama.");
  for (const path of [
    "/stok",
    "/karyawan/stok",
    "/kasir/stok",
    "/persediaan",
    "/stok-realtime",
    "/kasir/stok/opname",
    "/karyawan/stok/opname",
    "/kasir/shift",
  ])
    revalidatePath(path);
  return {
    id: String(data),
    ok: `Opname tersimpan (${rows.length} bahan). Stok outlet sudah disesuaikan.`,
  };
}

/** Selalu baca ulang dengan RLS pengguna; tidak mengganti stok atau hitungan fisik. */
export async function bacaStokSo(outletId: string): Promise<{ stok?: Record<string, number>; error?: string }> {
  const db = await supabaseServer();
  const { data, error } = await db.from("stok").select("bahan_id,jumlah").eq("outlet_id",outletId).eq("mode","asli");
  if (error) return { error: "Stok terbaru belum dapat dimuat. Draft tetap disimpan." };
  return { stok: Object.fromEntries((data ?? []).map(r => [r.bahan_id, Number(r.jumlah)])) };
}
