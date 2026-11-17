"use server";
import { revalidatePath } from "next/cache";
import { getSession } from "./session";
import { supabaseServer } from "./supabase/server";
import type { PemeriksaanKas, KoreksiKas, PratinjauKas } from "./rekonsiliasi-kas";
async function boleh() { return ["owner", "admin_pusat", "finance"].includes((await getSession())?.active?.role ?? ""); }
export async function periksaKas(sesi: string): Promise<{ data?: PemeriksaanKas; error?: string }> {
 if (!(await boleh())) return { error: "Hanya Owner/Admin Pusat/Akunting." };
 const db = await supabaseServer();
 const { data, error } = await db.rpc("periksa_rekonsiliasi_kas", { p_sesi: sesi });
 return error ? { error: error.message } : { data: data as PemeriksaanKas };
}
export async function koreksiKas(p: KoreksiKas): Promise<{ data?: PratinjauKas; error?: string }> {
 if (!(await boleh())) return { error: "Hanya Owner/Admin Pusat/Akunting." };
 const db = await supabaseServer();
 const { data, error } = await db.rpc("koreksi_rekonsiliasi_kas", { p });
 if (error) return { error: error.message };
 if (p.simpan) for (const path of ["/catatan-harian", "/laporan-pos", "/kasir/shift", "/karyawan/kas", "/dashboard"]) revalidatePath(path, "layout");
 return { data: data as PratinjauKas };
}
export async function verifikasiTransaksi(id: string, sidik: string, alasan: string) {
 if (!(await boleh())) return { error: "Hanya Owner/Admin Pusat/Akunting." };
 const db = await supabaseServer();
 const { error } = await db.rpc("verifikasi_transaksi_harian", { p_id: id, p_sidik: sidik, p_alasan: alasan });
 if (error) return { error: error.message };
 revalidatePath("/catatan-harian");
 return { ok: "Sudah diverifikasi. Nominal transaksi dan selisih kas tidak diubah." };
}
