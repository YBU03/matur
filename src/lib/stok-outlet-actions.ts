"use server";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "./supabase/server";
import { getSession } from "./session";
import type { LaporanStokOutlet } from "./stok-outlet";
export async function perintahStokOutlet(
  p: Record<string, unknown>,
): Promise<{ ok?: string; error?: string; id?: string }> {
  const db = await supabaseServer();
  const { data, error } = await db.rpc("kelola_stok_outlet", { p });
  if (error) return { error: error.message };
  for (const path of [
    "/stok/outlet",
    "/stok",
    "/stok-realtime",
    "/gudang/kiriman",
    "/operasional/kiriman",
  ])
    revalidatePath(path);
  return data as { ok: string; id: string };
}
export async function bacaLaporanStok(p: {
  outlet: string | null;
  awal: string;
  akhir: string;
  bahan?: string | null;
  batas?: string;
  waktu?: string;
  id?: string;
}): Promise<{ data?: LaporanStokOutlet; error?: string }> {
  const db = await supabaseServer();
  const { data, error } = await db.rpc("laporan_stok_outlet", {
    p_outlet: p.outlet,
    p_awal: p.awal,
    p_akhir: p.akhir,
    p_bahan: p.bahan ?? null,
    p_cursor_waktu: p.waktu ?? null,
    p_cursor_id: p.id ?? null,
    p_batas: p.batas ?? null,
  });
  return error ? { error: error.message } : { data: data as LaporanStokOutlet };
}
export async function fotoStokOutlet(
  form: FormData,
): Promise<{ path?: string; error?: string }> {
  const s = await getSession();
  if (!s?.active) return { error: "Silakan login" };
  const file = form.get("file");
  const outlet = String(form.get("outlet"));
  if (
    !(file instanceof File) ||
    !file.size ||
    file.size > 5242880 ||
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    !/^[0-9a-f-]{36}$/.test(outlet)
  )
    return { error: "Gunakan foto JPG/PNG/WebP maksimal 5 MB" };
  const path = `${outlet}/${s.userId}/${crypto.randomUUID()}.${file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg"}`;
  const db = await supabaseServer();
  const { error } = await db.storage
    .from("stok-outlet-bukti")
    .upload(path, file, { contentType: file.type });
  return error ? { error: error.message } : { path };
}
export async function bukaFotoStok(
  path: string,
): Promise<{ url?: string; error?: string }> {
  const db = await supabaseServer();
  const { data, error } = await db.storage
    .from("stok-outlet-bukti")
    .createSignedUrl(path, 120);
  return error ? { error: error.message } : { url: data.signedUrl };
}
