"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "./session";
import { supabaseServer } from "./supabase/server";

export type Result = { error?: string; ok?: string };
export type Rincian = { penerima: string; persen: number; pengelola: boolean; bank?: string | null; no_rekening?: string | null; atas_nama?: string | null };

const PUSAT = ["owner", "admin_pusat", "finance"];
const izin = async () => {
  const s = await getSession();
  return !!s?.active && PUSAT.includes(s.active.role);
};
const teks = (v: unknown, n = 100) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null);

export async function simpanSkema(id: string | null, d: { nama: string; keterangan: string; persen_sedekah: number; rincian: Rincian[] }): Promise<Result> {
  if (!(await izin())) return { error: "Tidak diizinkan." };
  const nama = teks(d.nama);
  if (!nama) return { error: "Nama skema wajib diisi." };
  const sedekah = Number(d.persen_sedekah);
  if (!Number.isFinite(sedekah) || sedekah < 0 || sedekah > 100) return { error: "Persen sedekah tidak valid." };
  const rincian = (Array.isArray(d.rincian) ? d.rincian : [])
    .map((r) => ({
      penerima: teks(r.penerima) ?? "",
      persen: Math.round(Number(r.persen) * 100) / 100,
      pengelola: !!r.pengelola,
      bank: teks(r.bank, 30),
      no_rekening: teks(r.no_rekening, 40),
      atas_nama: teks(r.atas_nama),
    }))
    .filter((r) => r.penerima);
  if (rincian.length === 0) return { error: "Tambahkan minimal satu penerima." };
  if (rincian.some((r) => !Number.isFinite(r.persen) || r.persen <= 0)) return { error: "Persen setiap penerima harus lebih dari 0." };
  const total = Math.round(rincian.reduce((s, r) => s + r.persen, 0) * 100) / 100;
  if (total !== 100) return { error: `Total persen harus 100% (sekarang ${total}%).` };
  const values = { nama, keterangan: teks(d.keterangan, 300), persen_sedekah: sedekah, rincian };
  const supabase = await supabaseServer();
  const { error } = id ? await supabase.from("skema_bagi_hasil").update(values).eq("id", id) : await supabase.from("skema_bagi_hasil").insert(values);
  if (error) return { error: error.message };
  revalidatePath("/skema-bagi-hasil");
  return { ok: "Skema tersimpan." };
}

export async function hapusSkema(id: string): Promise<Result> {
  if (!(await izin())) return { error: "Tidak diizinkan." };
  const supabase = await supabaseServer();
  const { count } = await supabase.from("outlet").select("id", { count: "exact", head: true }).eq("skema_bagi_hasil_id", id);
  if (count) return { error: "Skema masih dipakai outlet. Ganti skema outlet tersebut dulu." };
  const { error } = await supabase.from("skema_bagi_hasil").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/skema-bagi-hasil");
  return { ok: "Skema dipindahkan ke tempat sampah." };
}

export async function pilihSkema(outletId: string, skemaId: string | null): Promise<Result> {
  if (!(await izin())) return { error: "Tidak diizinkan." };
  const supabase = await supabaseServer();
  const { error, count } = await supabase.from("outlet").update({ skema_bagi_hasil_id: skemaId }, { count: "exact" }).eq("id", outletId);
  if (error || !count) return { error: "Gagal menyimpan pilihan skema." };
  revalidatePath("/skema-bagi-hasil");
  return { ok: "Skema outlet diperbarui." };
}
