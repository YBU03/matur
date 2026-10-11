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

type ImportRow = {
  kategori: string;
  bagian: string | null;
  nama: string;
  spesifikasi: string | null;
  qty: number;
  satuan: string | null;
  harga_satuan: number | null;
  harga_estimasi: number;
  harga_realisasi: number | null;
  status: string;
  keterangan: string | null;
};

const str = (v: unknown, max = 200) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const int = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null);

// Import rincian keperluan dari Excel (sudah dibaca & dipratinjau di browser)
export async function importRab(proyekId: string, rows: ImportRow[], ganti: boolean): Promise<Result> {
  if (!Array.isArray(rows) || rows.length === 0) return { error: "Tidak ada baris untuk diimpor." };
  if (rows.length > 2000) return { error: "Maksimal 2000 baris per import." };
  const data = rows.map((r, i) => ({
    proyek_id: proyekId,
    kategori: str(r.kategori, 60) ?? "Lainnya",
    bagian: str(r.bagian, 100),
    nama: str(r.nama) ?? "-",
    spesifikasi: str(r.spesifikasi),
    qty: typeof r.qty === "number" && Number.isFinite(r.qty) ? r.qty : 1,
    satuan: str(r.satuan, 30),
    harga_satuan: int(r.harga_satuan),
    harga_estimasi: int(r.harga_estimasi) ?? 0,
    harga_realisasi: int(r.harga_realisasi),
    status: ["rencana", "dibeli", "terpasang"].includes(r.status) ? r.status : "rencana",
    keterangan: str(r.keterangan, 500),
    urutan: i,
  }));
  const supabase = await supabaseServer();
  if (ganti) {
    // item lama dipindah ke tempat sampah (bisa dipulihkan 30 hari)
    const { error } = await supabase.from("item_rab").update({ deleted_at: new Date().toISOString() }).eq("proyek_id", proyekId).is("deleted_at", null);
    if (error) return { error: error.message.includes("row-level") ? "Hanya Admin Pusat yang bisa mengimpor." : error.message };
  }
  const { error } = await supabase.from("item_rab").insert(data);
  if (error) return { error: error.message.includes("row-level") ? "Hanya Admin Pusat yang bisa mengimpor." : error.message };
  revalidatePath(`/proyek/${proyekId}`);
  revalidatePath(`/proyek/${proyekId}/rab`);
  return { ok: `${data.length} item berhasil diimpor.` };
}
