import "server-only";
import { notFound } from "next/navigation";
import { getSession } from "./session";
import { supabaseServer } from "./supabase/server";
import { rentangLihat, type JadwalLihatParams } from "./jadwal/rentang-lihat";
import type { Jadwal, Shift } from "./sdm";
export const bolehLihatJadwal = (role: string) =>
  role === "owner" || role === "admin_pusat";
export async function loadJadwalLihat(p: JadwalLihatParams) {
  const s = await getSession();
  if (!s?.active || s.status !== "aktif" || !bolehLihatJadwal(s.active.role))
    notFound();
  const range = rentangLihat(p);
  const db = await supabaseServer();
  const { data: od, error: oe } = await db
    .from("outlet")
    .select("id,nama")
    .eq("mode", "asli")
    .is("deleted_at", null)
    .order("nama");
  const outlets = (od ?? []) as { id: string; nama: string }[];
  const outlet = outlets.find((o) => o.id === p.outlet) ?? outlets[0] ?? null;
  const empty = {
    role: s.active.role,
    range,
    outlets,
    outlet,
    shifts: [] as Shift[],
    jadwal: [] as Jadwal[],
    nama: {} as Record<string, string>,
    error: "",
  };
  if (oe)
    return {
      ...empty,
      error: "Daftar outlet belum dapat dimuat. Silakan coba lagi.",
    };
  if (!outlet) return empty;
  const [jr, sr] = await Promise.all([
    db
      .from("jadwal_shift")
      .select("id,shift_id,pengguna_id,tanggal,status")
      .eq("outlet_id", outlet.id)
      .eq("status", "terbit")
      .gte("tanggal", range.start)
      .lte("tanggal", range.end)
      .order("tanggal"),
    db
      .from("shift_outlet")
      .select("id,nama,jam_mulai,jam_selesai,urutan")
      .eq("outlet_id", outlet.id)
      .order("urutan"),
  ]);
  if (jr.error || sr.error)
    return { ...empty, error: "Jadwal belum dapat dimuat. Silakan coba lagi." };
  // Defense in depth: never serialize drafts, even if an upstream adapter ignores its filter.
  const jadwal = ((jr.data ?? []) as Jadwal[]).filter(
    (j) => j.status === "terbit",
  );
  const ids = [...new Set(jadwal.map((j) => j.pengguna_id))];
  const nama: Record<string, string> = {};
  if (ids.length) {
    const { data, error } = await db
      .from("pengguna")
      .select("id,nama")
      .in("id", ids);
    if (error)
      return {
        ...empty,
        error: "Nama karyawan belum dapat dimuat. Silakan coba lagi.",
      };
    for (const u of data ?? []) nama[u.id] = u.nama;
  }
  return { ...empty, jadwal, shifts: (sr.data ?? []) as Shift[], nama };
}
