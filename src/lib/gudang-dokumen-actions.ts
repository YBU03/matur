"use server";
import { getSession } from "./session";
import { supabaseServer } from "./supabase/server";
import { revalidatePath } from "next/cache";
export async function simpanDokumenGudang(form: FormData) {
  const s = await getSession();
  if (
    !s?.active ||
    !["owner", "admin_pusat", "admin_gudang"].includes(s.active.role)
  )
    return { error: "Tidak berwenang." };
  const alamat = String(form.get("alamat") ?? "").trim(),
    versi = Number(form.get("versi"));
  if (alamat.length < 10 || alamat.length > 600 || !Number.isSafeInteger(versi))
    return { error: "Alamat wajib 10–600 karakter." };
  const db = await supabaseServer();
  const { data: g, error: eg } = await db
    .from("pengaturan_dokumen_gudang")
    .select("logo_path,versi")
    .eq("id", true)
    .single();
  if (eg || !g) return { error: "Pengaturan belum dapat dimuat." };
  if (g.versi !== versi)
    return { error: "Pengaturan sudah berubah. Muat ulang dahulu." };
  let path: string | null = g.logo_path,
    uploaded: string | null = null;
  const file = form.get("logo");
  if (form.get("bawaan") === "on") path = null;
  else if (file instanceof File && file.size) {
    if (file.size > 2097152) return { error: "Ukuran logo maksimal 2 MB." };
    const bytes = new Uint8Array(await file.arrayBuffer());
    const png = [137, 80, 78, 71, 13, 10, 26, 10].every(
      (v, i) => bytes[i] === v,
    );
    const jpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    if (!png && !jpg) return { error: "Pilih gambar PNG atau JPG yang valid." };
    path = "logo/" + crypto.randomUUID() + (png ? ".png" : ".jpg");
    const { error } = await db.storage
      .from("dokumen-gudang")
      .upload(path, bytes, {
        contentType: png ? "image/png" : "image/jpeg",
        upsert: false,
      });
    if (error) return { error: "Logo gagal diunggah. Coba lagi." };
    uploaded = path;
  }
  const { error } = await db.rpc("atur_dokumen_gudang", {
    p_alamat: alamat,
    p_logo: path,
    p_versi: versi,
  });
  if (error) {
    if (uploaded) await db.storage.from("dokumen-gudang").remove([uploaded]);
    return { error: error.message };
  }
  for (const p of [
    "/gudang/pengaturan-dokumen",
    "/gudang/kiriman",
    "/operasional/kiriman",
    "/karyawan/kiriman",
  ])
    revalidatePath(p, "page");
  return { ok: "Logo dan alamat dokumen gudang tersimpan." };
}
