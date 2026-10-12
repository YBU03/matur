"use server";

import { revalidatePath } from "next/cache";
import { ROLES } from "./roles";
import { getSession } from "./session";
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

// Galeri desain cafe: admin mengunggah, mitra langsung bisa melihat (tanpa persetujuan)
export async function unggahDesain(form: FormData): Promise<Result> {
  const proyekId = String(form.get("proyek_id"));
  const judul = String(form.get("judul") ?? "").slice(0, 120);
  const file = form.get("foto");
  if (!(file instanceof File) || !file.size) return { error: "Pilih gambar desain." };
  if (file.size > 5 * 1024 * 1024) return { error: "Ukuran gambar maksimal 5 MB." };
  const supabase = await supabaseServer();
  const path = `${proyekId}/desain/${crypto.randomUUID()}.jpg`;
  const up = await supabase.storage.from("proyek").upload(path, file, { contentType: "image/jpeg" });
  if (up.error) return { error: up.error.message.includes("row-level") ? "Hanya Admin Pusat yang bisa mengunggah desain." : up.error.message };
  const { error } = await supabase.from("desain_proyek").insert({ proyek_id: proyekId, path, judul: judul || null });
  if (error) return { error: error.message };
  revalidatePath(`/proyek/${proyekId}`);
  return { ok: "Desain diunggah." };
}

export async function hapusDesain(proyekId: string, id: string): Promise<Result> {
  const supabase = await supabaseServer();
  const { error, count } = await supabase.from("desain_proyek").delete({ count: "exact" }).eq("id", id);
  if (error || !count) return { error: "Gagal menghapus (hanya Admin Pusat)." };
  revalidatePath(`/proyek/${proyekId}`);
  return { ok: "Desain dihapus." };
}

// Tetapkan tanggal Soft/Grand Opening yang dipakai (admin), mis. dari salah satu usulan
export async function tetapkanOpening(proyekId: string, jenis: "Soft Opening" | "Grand Opening", tanggal: string | null): Promise<Result> {
  if (tanggal && !/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) return { error: "Tanggal tidak valid." };
  const supabase = await supabaseServer();
  const kolom = jenis === "Soft Opening" ? "tgl_soft_opening" : "target_buka";
  const { error, count } = await supabase.from("proyek").update({ [kolom]: tanggal }, { count: "exact" }).eq("id", proyekId);
  if (error || !count) return { error: "Hanya Admin Pusat yang bisa menetapkan tanggal." };
  revalidatePath(`/proyek/${proyekId}`);
  return { ok: `Tanggal ${jenis} ditetapkan.` };
}

// Diskusi admin ↔ mitra per proyek
export async function kirimKomentar(proyekId: string, isi: string): Promise<Result> {
  const teks = isi.trim().slice(0, 2000);
  if (!teks) return { error: "Tulis pesan terlebih dahulu." };
  const s = await getSession();
  if (!s?.active) return { error: "Silakan login ulang." };
  const supabase = await supabaseServer();
  const { error } = await supabase.from("komentar_proyek").insert({ proyek_id: proyekId, nama: s.nama, peran: ROLES[s.active.role].label, isi: teks });
  if (error) return { error: error.message };
  revalidatePath(`/proyek/${proyekId}`);
  return { ok: "Terkirim." };
}

export async function hapusKomentar(proyekId: string, id: string): Promise<Result> {
  const supabase = await supabaseServer();
  const { error, count } = await supabase.from("komentar_proyek").delete({ count: "exact" }).eq("id", id);
  if (error || !count) return { error: "Tidak bisa menghapus pesan ini." };
  revalidatePath(`/proyek/${proyekId}`);
  return {};
}

// Dokumen: file diunggah langsung dari browser ke Storage (bisa >4 MB), lalu dicatat di sini
export async function catatDokumen(proyekId: string, d: { judul: string; jenis: string; path: string; tipe: string; ukuran: number }): Promise<Result> {
  if (!d.path.startsWith(`${proyekId}/dokumen/`)) return { error: "Lokasi file tidak valid." };
  const supabase = await supabaseServer();
  const { error } = await supabase.from("dokumen_proyek").insert({
    proyek_id: proyekId,
    judul: d.judul.slice(0, 150) || "Dokumen",
    jenis: d.jenis.slice(0, 40) || "Lainnya",
    path: d.path,
    tipe: d.tipe.slice(0, 80),
    ukuran: Math.round(d.ukuran),
  });
  if (error) return { error: error.message.includes("row-level") ? "Hanya Admin Pusat yang bisa mengunggah dokumen." : error.message };
  revalidatePath(`/proyek/${proyekId}`);
  return { ok: "Dokumen tersimpan." };
}

export async function hapusDokumen(proyekId: string, id: string): Promise<Result> {
  const supabase = await supabaseServer();
  const { error, count } = await supabase.from("dokumen_proyek").delete({ count: "exact" }).eq("id", id);
  if (error || !count) return { error: "Gagal menghapus (hanya Admin Pusat)." };
  revalidatePath(`/proyek/${proyekId}`);
  return { ok: "Dokumen dihapus." };
}
