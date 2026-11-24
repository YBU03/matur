"use server";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "./supabase/server";
import { getSession } from "./session";
export async function kelolaLaporanLanjut(p: Record<string, unknown>) {
  const db = await supabaseServer();
  const { data, error } = await db.rpc("kelola_laporan_lanjut", { p });
  if (error) return { error: error.message };
  for (const path of [
    "/laporan",
    "/laporan/rekap",
    "/transfer",
    "/portal/bep",
    "/dashboard",
    "/meeting-laporan",
    `/laporan/${p.laporan_id}/tindak-lanjut`,
  ])
    revalidatePath(path);
  return data as { ok?: string; id?: string; error?: string };
}
export async function uploadBuktiLaporan(fd: FormData) {
  const s = await getSession();
  if (
    !s?.active ||
    !["owner", "admin_pusat", "finance"].includes(s.active.role)
  )
    return { error: "Hanya Akunting/Pusat" };
  const f = fd.get("file"),
    id = String(fd.get("laporan_id"));
  if (
    !(f instanceof File) ||
    f.size === 0 ||
    f.size > 5242880 ||
    !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(
      f.type,
    ) ||
    !/^[0-9a-f-]{36}$/.test(id)
  )
    return { error: "Gunakan JPG/PNG/WebP/PDF maksimal 5 MB" };
  const ext =
    f.type === "application/pdf"
      ? "pdf"
      : f.type === "image/png"
        ? "png"
        : f.type === "image/webp"
          ? "webp"
          : "jpg";
  const path = `${id}/${s.userId}/${crypto.randomUUID()}.${ext}`;
  const db = await supabaseServer();
  const { error } = await db.storage
    .from("laporan-bukti-bayar")
    .upload(path, f, { contentType: f.type });
  return error ? { error: error.message } : { path };
}
export async function bukaBuktiLaporan(path: string) {
  const db = await supabaseServer();
  const { data, error } = await db.storage
    .from("laporan-bukti-bayar")
    .createSignedUrl(path, 120);
  return error ? { error: error.message } : { url: data.signedUrl };
}
