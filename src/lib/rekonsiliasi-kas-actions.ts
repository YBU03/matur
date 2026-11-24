"use server";
import { revalidatePath } from "next/cache";
import { getSession } from "./session";
import { supabaseServer } from "./supabase/server";
import type {
  PemeriksaanKas,
  KoreksiKas,
  PratinjauKas,
} from "./rekonsiliasi-kas";
async function boleh() {
  return ["owner", "admin_pusat", "finance"].includes(
    (await getSession())?.active?.role ?? "",
  );
}
export async function periksaKas(
  sesi: string,
): Promise<{ data?: PemeriksaanKas; error?: string }> {
  if (!(await boleh())) return { error: "Hanya Owner/Admin Pusat/Akunting." };
  const db = await supabaseServer();
  const { data, error } = await db.rpc("periksa_rekonsiliasi_kas", {
    p_sesi: sesi,
  });
  if (error) return { error: error.message };
  const [audit, tunai] = await Promise.all([
    db
      .from("revisi_aktual_kas")
      .select("id,sesi_id,lama,baru,alasan,nama,created_at")
      .eq("sesi_id", sesi)
      .order("created_at", { ascending: false }),
    db
      .from("transaksi")
      .select("id,nomor,created_at,pembayaran!inner(nominal)")
      .eq("sesi_kas_id", sesi)
      .eq("mode", "asli")
      .eq("status", "lunas")
      .eq("pembayaran.metode", "tunai")
      .order("created_at")
      .limit(201),
  ]);
  if (audit.error || tunai.error)
    return { error: audit.error?.message ?? tunai.error?.message };
  return {
    data: {
      ...(data as PemeriksaanKas),
      revisi_aktual: audit.data ?? [],
      transaksi_tunai: (tunai.data ?? [])
        .slice(0, 200)
        .map((t) => ({
          ...t,
          nominal: t.pembayaran.reduce((n, p) => n + Number(p.nominal), 0),
        })),
      tunai_terpotong: (tunai.data?.length ?? 0) > 200,
    },
  };
}
export async function koreksiKas(
  p: KoreksiKas,
): Promise<{ data?: PratinjauKas; error?: string }> {
  if (!(await boleh())) return { error: "Hanya Owner/Admin Pusat/Akunting." };
  const db = await supabaseServer();
  const { data, error } = await db.rpc("koreksi_rekonsiliasi_kas", { p });
  if (error) return { error: error.message };
  if (p.simpan)
    for (const path of [
      "/catatan-harian",
      "/laporan-pos",
      "/kasir/shift",
      "/karyawan/kas",
      "/dashboard",
    ])
      revalidatePath(path, "layout");
  return { data: data as PratinjauKas };
}
export async function verifikasiTransaksi(
  id: string,
  sidik: string,
  alasan: string,
) {
  if (!(await boleh())) return { error: "Hanya Owner/Admin Pusat/Akunting." };
  const db = await supabaseServer();
  const { error } = await db.rpc("verifikasi_transaksi_harian", {
    p_id: id,
    p_sidik: sidik,
    p_alasan: alasan,
  });
  if (error) return { error: error.message };
  revalidatePath("/catatan-harian");
  return {
    ok: "Sudah diverifikasi. Nominal transaksi dan selisih kas tidak diubah.",
  };
}
