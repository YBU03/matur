"use server";
import { revalidatePath } from "next/cache";
import { getSession } from "./session";
import { supabaseServer } from "./supabase/server";
import type { BelanjaInput } from "./belanja-proyek";

async function admin() {
  const s = await getSession();
  if (s?.status !== "aktif" || !s.active || !["owner", "admin_pusat"].includes(s.active.role)) throw new Error("Hanya Owner/Admin Pusat.");
  return supabaseServer();
}
function refresh(id: string) {
  revalidatePath(`/proyek/${id}`); revalidatePath(`/proyek/${id}/rab`); revalidatePath("/proyek"); revalidatePath("/portal/pembangunan");
}
export async function simpanBelanja(proyekId: string, id: string, versi: string | null, input: BelanjaInput, form: FormData): Promise<{ error?: string }> {
  let uploaded: string | null = null;
  let db: Awaited<ReturnType<typeof supabaseServer>> | undefined;
  try {
    db = await admin();
    const file = form.get("nota");
    let path = input.nota_path;
    if (file instanceof File && file.size) {
      if (file.size > 5 * 1024 * 1024) return { error: "Bukti nota maksimal 5 MB." };
      const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
      const head = String.fromCharCode(...bytes);
      const ext = file.type === "application/pdf" && head.startsWith("%PDF-") ? "pdf" : file.type === "image/png" && bytes[0] === 137 && head.slice(1,4) === "PNG" ? "png" : file.type === "image/jpeg" && bytes[0] === 255 && bytes[1] === 216 ? "jpg" : file.type === "image/webp" && head.startsWith("RIFF") && head.slice(8,12) === "WEBP" ? "webp" : null;
      if (!ext) return { error: "Pilih foto JPG/PNG/WebP atau PDF yang valid." };
      path = `${proyekId}/belanja/${id}/${crypto.randomUUID()}.${ext}`;
      const up = await db.storage.from("proyek").upload(path, file, { contentType: file.type, upsert: false });
      if (up.error) return { error: "Bukti nota gagal diunggah." };
      uploaded = path;
    }
    const { error } = await db.rpc("simpan_belanja_proyek", { p_id: id, p_proyek: proyekId, p_versi: versi, p_data: { ...input, nota_path: path } });
    if (error) throw new Error(error.message);
    refresh(proyekId); return {};
  } catch (e) {
    if (uploaded && db) await db.storage.from("proyek").remove([uploaded]);
    return { error: e instanceof Error ? e.message : "Belanja belum tersimpan. Coba lagi." };
  }
}
export async function catatBayarBelanja(proyekId: string, belanjaId: string, versi: string, data: NonNullable<BelanjaInput["pembayaran"]>): Promise<{ error?: string }> {
  try {
    const db = await admin();
    const { error } = await db.rpc("bayar_belanja_proyek", { p_id: data.id, p_belanja: belanjaId, p_versi: versi, p_data: data });
    if (error) return { error: error.message };
    refresh(proyekId); return {};
  } catch (e) { return { error: e instanceof Error ? e.message : "Pembayaran belum tersimpan." }; }
}
export async function batalkanBelanja(proyekId: string, id: string, versi: string, alasan: string): Promise<{ error?: string }> {
  try {
    const db = await admin();
    const { error } = await db.rpc("batalkan_belanja_proyek", { p_id: id, p_versi: versi, p_alasan: alasan });
    if (error) return { error: error.message };
    refresh(proyekId); return {};
  } catch (e) { return { error: e instanceof Error ? e.message : "Nota belum dibatalkan." }; }
}

export async function koreksiBayarBelanja(proyekId: string, belanjaId: string, pembayaranId: string | null, versi: string, alasan: string): Promise<{ error?: string }> {
  try {
    const db = await admin();
    const { error } = await db.rpc("koreksi_bayar_belanja_proyek", { p_id: pembayaranId, p_belanja: belanjaId, p_versi: versi, p_alasan: alasan });
    if (error) return { error: error.message };
    refresh(proyekId); return {};
  } catch (e) { return { error: e instanceof Error ? e.message : "Koreksi belum tersimpan." }; }
}

export async function hapusBelanja(proyekId: string, id: string, versi: string, alasan: string, akuiPembayaran: boolean): Promise<{ error?: string }> {
  try {
    const db = await admin();
    const { error } = await db.rpc("hapus_belanja_proyek", { p_id: id, p_versi: versi, p_alasan: alasan, p_akui_pembayaran: akuiPembayaran });
    if (error) return { error: error.message };
    refresh(proyekId); return {};
  } catch (e) { return { error: e instanceof Error ? e.message : "Nota belum dihapus." }; }
}
