"use server";
import { getSession } from "./session";
import { supabaseServer } from "./supabase/server";
import { revalidatePath } from "next/cache";
export async function aksiEditorGudang(
  fn: "editor_dokumen_gudang" | "outlet_dokumen_gudang" | "atur_telepon_gudang",
  p: Record<string, unknown>,
) {
  const s = await getSession();
  if (
    !s?.active ||
    !["owner", "admin_pusat", "admin_gudang"].includes(s.active.role) ||
    ![
      "editor_dokumen_gudang",
      "outlet_dokumen_gudang",
      "atur_telepon_gudang",
    ].includes(fn)
  )
    return { error: "Tidak diizinkan." };
  const db = await supabaseServer();
  const { data, error } = await db.rpc(
    fn,
    fn === "atur_telepon_gudang" ? p : { p },
  );
  if (error) return { error: error.message };
  for (const path of [
    "/gudang/kiriman",
    "/gudang/outlet",
    "/gudang/dokumen-arsip",
    "/gudang/pengaturan-dokumen",
    "/operasional/kiriman",
    "/karyawan/kiriman",
    "/gudang/laba-rugi",
  ])
    revalidatePath(path);
  if (fn === "editor_dokumen_gudang") {
    const { data: document, error: e } = await db
      .from("dokumen_kiriman_gudang")
      .select("jenis,isi,terbit,versi,arsip_at,terbit_at")
      .eq("kiriman_id", String(p.id))
      .eq("jenis", String(p.jenis))
      .single();
    if (e)
      return {
        error:
          "Tersimpan, tetapi dokumen belum dapat dimuat. Muat ulang halaman.",
      };
    if (document.versi !== Number(data))
      return { error: "Dokumen diperbarui pengguna lain. Muat ulang dahulu." };
    return { ok: "Tersimpan.", data, document };
  }
  return { ok: "Tersimpan.", data };
}
