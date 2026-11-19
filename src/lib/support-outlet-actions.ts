"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "./session";
import { supabaseServer } from "./supabase/server";
import { nomorSupport } from "./support-outlet";

type Input = {
  id: string;
  bagian: string;
  nama: string;
  nomor: string;
  aktif: boolean;
  urutan: number;
  versi: string | null;
};
async function diizinkan() {
  const s = await getSession();
  return !!s?.active && ["owner", "admin_pusat"].includes(s.active.role);
}
function refresh() {
  revalidatePath("/pengaturan/support-outlet");
  revalidatePath("/portal/support-outlet");
}
export async function simpanSupport(d: Input): Promise<{ error?: string }> {
  if (!(await diizinkan()))
    return { error: "Hanya Owner/Admin Pusat yang dapat mengelola kontak." };
  const nomor = nomorSupport(d.nomor);
  if (!nomor)
    return { error: "Nomor tidak valid. Gunakan 08..., 62..., atau +62...." };
  const bagian = d.bagian.trim(),
    nama = d.nama.trim();
  if (
    !bagian ||
    bagian.length > 80 ||
    !nama ||
    nama.length > 120 ||
    !Number.isInteger(d.urutan) ||
    d.urutan < 0 ||
    d.urutan > 9999 ||
    typeof d.aktif !== "boolean"
  )
    return { error: "Lengkapi bagian, nama petugas, dan urutan 0–9999." };
  const db = await supabaseServer();
  const values = { bagian, nama, nomor, aktif: d.aktif, urutan: d.urutan };
  const result = d.versi
    ? await db
        .from("support_outlet")
        .update(values)
        .eq("id", d.id)
        .eq("updated_at", d.versi)
        .is("deleted_at", null)
        .select("id")
        .maybeSingle()
    : await db
        .from("support_outlet")
        .insert({ id: d.id, ...values })
        .select("id")
        .single();
  if (result.error)
    return {
      error: "Kontak belum berhasil disimpan. Muat ulang dan coba lagi.",
    };
  if (!result.data)
    return { error: "Kontak sudah berubah. Muat ulang sebelum mengedit lagi." };
  refresh();
  return {};
}
export async function hapusSupport(
  id: string,
  versi: string,
): Promise<{ error?: string }> {
  if (!(await diizinkan()))
    return { error: "Hanya Owner/Admin Pusat yang dapat menghapus kontak." };
  const db = await supabaseServer();
  const { data, error } = await db
    .from("support_outlet")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("updated_at", versi)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error) return { error: "Kontak belum berhasil dihapus. Coba lagi." };
  if (!data)
    return { error: "Kontak sudah berubah. Muat ulang sebelum menghapus." };
  refresh();
  return {};
}
