"use server";

import { revalidatePath } from "next/cache";
import { ENTITIES, parseForm } from "./master";
import { getSession } from "./session";
import { supabaseServer } from "./supabase/server";

export type Result = { error?: string };

async function guard(entityKey: string) {
  const entity = ENTITIES[entityKey];
  const s = await getSession();
  if (!entity || !s?.active) return null;
  return { entity, s, supabase: await supabaseServer() };
}

const friendly = (msg: string, entity?: { fields: { key: string; label: string }[] }) => {
  const kosong = msg.match(/null value in column "(\w+)"/);
  if (kosong) return `${entity?.fields.find((f) => f.key === kosong[1])?.label ?? kosong[1]} wajib diisi`;
  return pesan(msg);
};
const pesan = (msg: string) =>
  msg.includes("row-level security")
    ? "Peran Anda tidak punya izin mengubah data ini."
    : msg.includes("perjanjian_check")
      ? "Persentase mitra + pengelola harus 100%."
      : msg;

/** `hanya`: saat mengubah dari form ringkas, hanya kolom ini yang diperiksa & disimpan (kolom lain tidak disentuh). */
export async function saveMaster(entityKey: string, id: string | null, form: Record<string, string | boolean>, hanya?: string[]): Promise<Result> {
  const g = await guard(entityKey);
  if (!g) return { error: "Tidak diizinkan." };
  const entity = id && hanya?.length ? { ...g.entity, fields: g.entity.fields.filter((f) => hanya.includes(f.key)) } : g.entity;
  const { values, errors } = parseForm(entity, form);
  if (errors.length) return { error: errors.join(", ") };
  // HPP per satuan pakai = harga beli ÷ isi kemasan bila tidak diisi
  if (g.entity.table === "bahan" && values.harga_pokok === null)
    values.harga_pokok = Math.round((Number(values.harga_beli ?? 0) / Math.max(Number(values.konversi ?? 1), 0.001)) * 10000) / 10000;
  // nama pengusul tanggal opening disimpan sebagai teks (mitra tidak bisa membaca data pengguna lain)
  if (g.entity.table === "usulan_tanggal" && !id) values.nama_pengusul = g.s.nama;
  if (g.entity.table === "item_rab" && values.harga_estimasi === null)
    values.harga_estimasi = Math.round(Number(values.qty ?? 0) * Number(values.harga_satuan ?? 0));
  const q = id ? g.supabase.from(g.entity.table).update(values).eq("id", id) : g.supabase.from(g.entity.table).insert(values);
  const { data: baru, error } = await q.select("id").single();
  if (error) return { error: friendly(error.message, g.entity) };
  if (URUT.has(g.entity.table) && values.urutan != null) await sisipkan(g.supabase, g.entity.table, String(baru.id), Number(values.urutan));
  revalidatePath(`/master/${entityKey}`);
  return {};
}

// Daftar per proyek yang urutannya bisa diatur (nomor urutan & geser ⋮⋮)
const URUT = new Set(["jadwal_proyek", "pekerjaan", "checklist_proyek"]);
type Db = Awaited<ReturnType<typeof supabaseServer>>;

/** Taruh baris di posisi `posisi` (1, 2, …); baris lain bergeser ke bawah, lalu nomor dirapikan 1..n. */
async function sisipkan(db: Db, table: string, id: string, posisi: number) {
  const { data: me } = await db.from(table).select("proyek_id").eq("id", id).single();
  if (!me) return;
  const { data: rows } = await db.from(table).select("id, urutan").eq("proyek_id", me.proyek_id).is("deleted_at", null).order("urutan");
  const lain = (rows ?? []).filter((r) => r.id !== id);
  const ke = Math.min(Math.max(Math.round(posisi), 1), lain.length + 1) - 1;
  lain.splice(ke, 0, { id, urutan: -1 });
  await simpanUrutan(db, table, lain);
}

async function simpanUrutan(db: Db, table: string, rows: { id: string; urutan: number }[]) {
  const ubah = rows.map((r, i) => ({ id: r.id, lama: r.urutan, baru: i + 1 })).filter((r) => r.lama !== r.baru);
  await Promise.all(ubah.map((r) => db.from(table).update({ urutan: r.baru }).eq("id", r.id)));
}

/** Simpan urutan baru hasil geser (ids sesuai urutan tampil). */
export async function urutkanBaris(entityKey: string, ids: string[]): Promise<Result> {
  const g = await guard(entityKey);
  if (!g || !URUT.has(g.entity.table) || !g.entity.editors.includes(g.s.active!.role)) return { error: "Tidak diizinkan." };
  const { data: rows, error } = await g.supabase.from(g.entity.table).select("id, urutan").in("id", ids);
  if (error) return { error: pesan(error.message) };
  const lama = new Map((rows ?? []).map((r) => [r.id, r.urutan as number]));
  await simpanUrutan(g.supabase, g.entity.table, ids.filter((x) => lama.has(x)).map((x) => ({ id: x, urutan: lama.get(x)! })));
  return {};
}

// AKS-06/07: hapus = pindah ke tempat sampah; pulihkan = kosongkan deleted_at
export async function setDeleted(entityKey: string, id: string, deleted: boolean): Promise<Result> {
  const g = await guard(entityKey);
  if (!g) return { error: "Tidak diizinkan." };
  const { error } = await g.supabase
    .from(g.entity.table)
    .update({ deleted_at: deleted ? new Date().toISOString() : null })
    .eq("id", id)
    .select("id")
    .single();
  if (error) return { error: friendly(error.message) };
  revalidatePath(`/master/${entityKey}`);
  return {};
}

// Unggah foto menu ke bucket publik "menu" (sudah dikompres di browser)
export async function uploadFotoMenu(form: FormData): Promise<{ error?: string; url?: string }> {
  const file = form.get("foto");
  if (!(file instanceof File) || !file.size) return { error: "Pilih foto." };
  if (file.size > 2 * 1024 * 1024) return { error: "Ukuran foto maksimal 2 MB." };
  const supabase = await supabaseServer();
  const path = `${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from("menu").upload(path, file, { contentType: "image/jpeg" });
  if (error) return { error: error.message.includes("row-level") ? "Hanya Owner/Admin Pusat yang bisa mengunggah foto." : error.message };
  return { url: supabase.storage.from("menu").getPublicUrl(path).data.publicUrl };
}
