"use server";
import { revalidatePath } from "next/cache";
import { getSession } from "./session";
import { supabaseServer } from "./supabase/server";
async function boleh() {
  const s = await getSession();
  return s?.active &&
    ["owner", "admin_pusat", "finance"].includes(s.active.role)
    ? s
    : null;
}
export async function aksiSubsidi(
  aksi: "edit" | "bayar" | "batal",
  p: Record<string, unknown>,
) {
  if (!(await boleh())) return { error: "Hanya Accounting/Pusat." };
  const rpc = {
    edit: "edit_tagihan_subsidi",
    bayar: "bayar_tagihan_subsidi",
    batal: "batal_bayar_subsidi",
  }[aksi];
  if (!rpc) return { error: "Aksi tidak valid." };
  const db = await supabaseServer();
  const { error } = await db.rpc(rpc, { p });
  if (error) return { error: error.message };
  revalidatePath("/subsidi-promo");
  return {};
}
export async function unggahBuktiSubsidi(
  form: FormData,
): Promise<{ path?: string; error?: string }> {
  const s = await boleh();
  if (!s) return { error: "Hanya Accounting/Pusat." };
  const f = form.get("file");
  if (
    !(f instanceof File) ||
    f.size < 1 ||
    f.size > 5242880 ||
    !["image/jpeg", "image/png", "application/pdf"].includes(f.type)
  )
    return { error: "Gunakan JPG, PNG atau PDF maksimal 5 MB." };
  const b = new Uint8Array(await f.slice(0, 8).arrayBuffer());
  if (
    !(
      (f.type === "image/jpeg" &&
        b[0] === 255 &&
        b[1] === 216 &&
        b[2] === 255) ||
      (f.type === "image/png" &&
        b[0] === 137 &&
        b[1] === 80 &&
        b[2] === 78 &&
        b[3] === 71) ||
      (f.type === "application/pdf" &&
        b[0] === 37 &&
        b[1] === 80 &&
        b[2] === 68 &&
        b[3] === 70)
    )
  )
    return { error: "Isi berkas tidak sesuai format." };
  const path = `${s.userId}/${crypto.randomUUID()}.${f.type === "application/pdf" ? "pdf" : f.type === "image/png" ? "png" : "jpg"}`;
  const db = await supabaseServer();
  const { error } = await db.storage
    .from("subsidi-bukti")
    .upload(path, f, { contentType: f.type, upsert: false });
  return error ? { error: "Bukti belum dapat diunggah." } : { path };
}
export async function bukaBuktiSubsidi(path: string) {
  if (!(await boleh())) return { error: "Tidak diizinkan." };
  const db = await supabaseServer();
  const { data, error } = await db.storage
    .from("subsidi-bukti")
    .createSignedUrl(path, 60);
  return error
    ? { error: "Bukti belum dapat dibuka." }
    : { url: data.signedUrl };
}
