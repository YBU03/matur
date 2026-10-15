import "server-only";
// Data SDM outlet (shift, jadwal, absensi, izin) untuk halaman HRD/SPV dan terminal staf.
import { hariIni, shiftEndInstant, shiftStartInstant } from "./jadwal/waktu";
import type { Session } from "./session";
import { supabaseServer } from "./supabase/server";

export type Shift = { id: string; nama: string; jam_mulai: string; jam_selesai: string; min_orang: number; urutan: number; aktif: boolean };
export type Staf = { id: string; nama: string; peran: string; jatah_libur: number };
export type Jadwal = { id: string; shift_id: string; pengguna_id: string; tanggal: string; status: "draft" | "terbit" };
export type Izin = {
  id: string;
  pengguna_id: string;
  jenis: "izin" | "libur" | "sakit";
  tanggal: string;
  alasan: string | null;
  status: "menunggu" | "disetujui" | "ditolak" | "dibatalkan";
  alasan_tolak: string | null;
  created_at: string;
};
export type AturanSdm = { toleransi_telat_menit: number; jatah_libur_default: number; izin_min_hari: number; libur_mingguan_dibuka: boolean };

/** Owner & HRD mengelola semua outlet; SPV hanya outletnya. */
export const PENGELOLA_SDM = ["owner", "hrd", "spv"];

const jam = (t: string) => t.slice(0, 5);

export async function outletSdm(s: Session) {
  const supabase = await supabaseServer();
  const { data } = await supabase.from("outlet").select("id, nama, jam_operasional").eq("mode", "asli").is("deleted_at", null).order("tgl_mulai");
  const semua = data ?? [];
  return s.active?.role === "spv" ? semua.filter((o) => o.id === s.active!.outletId) : semua;
}

export async function aturanSdm(): Promise<AturanSdm> {
  const supabase = await supabaseServer();
  const { data } = await supabase.from("perusahaan").select("toleransi_telat_menit, jatah_libur_default, izin_min_hari, libur_mingguan_dibuka").limit(1).maybeSingle();
  return data ?? { toleransi_telat_menit: 5, jatah_libur_default: 1, izin_min_hari: 3, libur_mingguan_dibuka: false };
}

export async function muatShift(outletId: string): Promise<Shift[]> {
  const supabase = await supabaseServer();
  const { data } = await supabase.from("shift_outlet").select("id, nama, jam_mulai, jam_selesai, min_orang, urutan, aktif").eq("outlet_id", outletId).order("urutan").order("jam_mulai");
  return (data ?? []).map((x) => ({ ...x, jam_mulai: jam(x.jam_mulai), jam_selesai: jam(x.jam_selesai) }));
}

export async function muatStaf(outletId: string): Promise<Staf[]> {
  const supabase = await supabaseServer();
  const { data } = await supabase.rpc("staf_jadwal", { p_outlet: outletId });
  return (data ?? []) as Staf[];
}

export async function muatJadwal(outletId: string, dari: string, sampai: string, penggunaId?: string): Promise<Jadwal[]> {
  const supabase = await supabaseServer();
  let q = supabase.from("jadwal_shift").select("id, shift_id, pengguna_id, tanggal, status").eq("outlet_id", outletId).gte("tanggal", dari).lte("tanggal", sampai);
  if (penggunaId) q = q.eq("pengguna_id", penggunaId);
  const { data } = await q.order("tanggal");
  return (data ?? []) as Jadwal[];
}

export async function muatIzin(outletId: string, dari: string, sampai: string, opsi: { status?: string[]; penggunaId?: string } = {}): Promise<Izin[]> {
  const supabase = await supabaseServer();
  let q = supabase.from("pengajuan_izin").select("id, pengguna_id, jenis, tanggal, alasan, status, alasan_tolak, created_at").eq("outlet_id", outletId).gte("tanggal", dari).lte("tanggal", sampai);
  if (opsi.status) q = q.in("status", opsi.status);
  if (opsi.penggunaId) q = q.eq("pengguna_id", opsi.penggunaId);
  const { data } = await q.order("tanggal");
  return (data ?? []) as Izin[];
}

export type Absen = {
  id: string;
  pengguna_id: string;
  jadwal_id: string | null;
  tanggal: string;
  masuk_at: string;
  pulang_at: string | null;
  status: "tepat" | "telat" | "tanpa_jadwal";
  telat_menit: number;
  masuk_foto: string | null;
  pulang_foto: string | null;
  masuk_lat: number | null;
  masuk_lng: number | null;
  pulang_lat: number | null;
  pulang_lng: number | null;
  perangkat: "hp" | "outlet" | null;
  masuk_catatan?: string | null;
  pulang_catatan?: string | null;
  masuk_lokasi_valid?: boolean | null;
  pulang_lokasi_valid?: boolean | null;
  catatan: string | null;
};

export async function muatAbsensi(outletId: string, dari: string, sampai: string, penggunaId?: string): Promise<Absen[]> {
  const supabase = await supabaseServer();
  let q = supabase
    .from("absensi")
    .select("id, pengguna_id, jadwal_id, tanggal, masuk_at, pulang_at, status, telat_menit, masuk_foto, pulang_foto, masuk_lat, masuk_lng, pulang_lat, pulang_lng, perangkat, catatan, masuk_catatan, pulang_catatan, masuk_lokasi_valid, pulang_lokasi_valid")
    .eq("outlet_id", outletId)
    .gte("tanggal", dari)
    .lte("tanggal", sampai);
  if (penggunaId) q = q.eq("pengguna_id", penggunaId);
  const { data } = await q.order("masuk_at");
  return (data ?? []) as Absen[];
}

/** URL sementara (1 jam) untuk foto selfie absensi. */
export async function urlFoto(paths: (string | null)[]): Promise<Record<string, string>> {
  const daftar = [...new Set(paths.filter((p): p is string => !!p))];
  if (!daftar.length) return {};
  const supabase = await supabaseServer();
  const { data } = await supabase.storage.from("absensi").createSignedUrls(daftar, 3600);
  return Object.fromEntries((data ?? []).filter((d) => d.signedUrl && d.path).map((d) => [d.path!, d.signedUrl as string]));
}

/**
 * Pengingat di terminal staf (pengganti push notification): shift hari ini yang mulai ≤ 60 menit lagi
 * atau sudah lewat tapi belum absen masuk, dan permintaan tukar shift yang menunggu jawaban.
 */
export async function pengingatShift(uid: string, outletId: string): Promise<{ teks: string; href: string; mendesak: boolean } | null> {
  const today = hariIni();
  const supabase = await supabaseServer();
  const [{ data: jadwal }, { data: absen }, { count: tukar }] = await Promise.all([
    supabase.from("jadwal_shift").select("id, shift:shift_id(nama, jam_mulai, jam_selesai)").eq("pengguna_id", uid).eq("outlet_id", outletId).eq("tanggal", today).eq("status", "terbit"),
    supabase.from("absensi").select("jadwal_id, pulang_at").eq("pengguna_id", uid).eq("tanggal", today),
    supabase.from("tukar_shift").select("id", { count: "exact", head: true }).eq("rekan_id", uid).eq("status", "menunggu_rekan"),
  ]);
  const now = Date.now();
  for (const j of jadwal ?? []) {
    const sh = j.shift as unknown as { nama: string; jam_mulai: string; jam_selesai: string } | null;
    if (!sh || (absen ?? []).some((a) => a.jadwal_id === j.id)) continue;
    const mulai = shiftStartInstant(today, sh.jam_mulai.slice(0, 5)).getTime();
    const selesai = shiftEndInstant(today, sh.jam_mulai.slice(0, 5), sh.jam_selesai.slice(0, 5)).getTime();
    const menit = Math.round((mulai - now) / 60_000);
    if (now > selesai || menit > 60) continue;
    return menit > 0
      ? { teks: `⏰ Shift ${sh.nama} mulai ${sh.jam_mulai.slice(0, 5)} (${menit} menit lagi) — jangan lupa absen masuk`, href: "/kasir/absen", mendesak: menit <= 15 }
      : { teks: `⚠️ Shift ${sh.nama} sudah mulai ${sh.jam_mulai.slice(0, 5)} — Anda belum absen masuk`, href: "/kasir/absen", mendesak: true };
  }
  if (tukar) return { teks: `🔁 ${tukar} permintaan tukar shift menunggu jawaban Anda`, href: "/kasir/jadwal", mendesak: false };
  return null;
}
