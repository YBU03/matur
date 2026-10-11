"use server";

import { revalidatePath } from "next/cache";
import { supabaseServer } from "./supabase/server";

export type Result = { error?: string; ok?: string };

// PRY-04: PIC melapor progres + foto. Foto sudah dikompres di browser.
export async function laporProgres(form: FormData): Promise<Result> {
  const proyekId = String(form.get("proyek_id"));
  const pekerjaanId = String(form.get("pekerjaan_id"));
  const progres = Math.min(100, Math.max(0, Number(form.get("progres")) || 0));
  const keterangan = String(form.get("keterangan") ?? "");
  const file = form.get("foto");
  if (!(file instanceof File) || !file.size) return { error: "Lampirkan foto progres." };
  if (file.size > 5 * 1024 * 1024) return { error: "Ukuran foto maksimal 5 MB." };

  const supabase = await supabaseServer();
  const path = `${proyekId}/${pekerjaanId}/${crypto.randomUUID()}.jpg`;
  const up = await supabase.storage.from("proyek").upload(path, file, { contentType: file.type || "image/jpeg" });
  if (up.error) return { error: "Gagal mengunggah foto: " + up.error.message };
  const { error } = await supabase.rpc("ajukan_progres", { p_pekerjaan: pekerjaanId, p_path: path, p_keterangan: keterangan, p_progres: progres });
  if (error) return { error: error.message };
  revalidatePath(`/proyek/${proyekId}`);
  return { ok: "Progres terkirim dan menunggu persetujuan Admin Pusat." };
}

export async function periksaFoto(proyekId: string, fotoId: string, setuju: boolean): Promise<Result> {
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("periksa_progres", { p_foto: fotoId, p_setuju: setuju });
  if (error) return { error: error.message };
  revalidatePath(`/proyek/${proyekId}`);
  return { ok: setuju ? "Disetujui dan tampil ke mitra." : "Ditolak." };
}
