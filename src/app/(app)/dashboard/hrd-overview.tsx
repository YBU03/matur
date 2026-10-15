import { LiveRefresh } from "@/components/live-refresh";
import { hitungRekap } from "@/lib/jadwal/rekap";
import { addDays, hariIni } from "@/lib/jadwal/waktu";
import { ringkasHrd } from "@/lib/hrd-dashboard";
import { outletSdm, muatShift, muatStaf, type Absen, type Izin, type Jadwal } from "@/lib/sdm";
import type { Session } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { HrdVisual } from "./hrd-visual";

// Ranges are paged so larger outlet rosters do not silently hit the API row limit.
async function semua<T>(page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>): Promise<T[]> {
  const result: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error) throw new Error("Data dashboard HRD belum dapat dimuat. Silakan coba lagi.");
    result.push(...(data ?? []) as T[]);
    if (!data || data.length < 1000) return result;
  }
}

export async function HrdOverview({ s, outletId, periode }: { s: Session; outletId?: string; periode?: string }) {
  const outlets = await outletSdm(s);
  const selected = outlets.some((o) => o.id === outletId) ? outletId! : "";
  const cakupan = selected ? outlets.filter((o) => o.id === selected) : outlets;
  if (!cakupan.length) return <p className="rounded-2xl border bg-white p-6">Belum ada outlet untuk dashboard HRD.</p>;
  const days = periode === "30" ? 30 : 7;
  const today = hariIni();
  const dari = addDays(today, 1 - days);
  const ids = cakupan.map((o) => o.id);
  const db = await supabaseServer();
  const [{ count: izin, error: ei }, { count: tukar, error: et }, { count: draft, error: ed }, ...data] = await Promise.all([
    db.from("pengajuan_izin").select("id", { count: "exact", head: true }).in("outlet_id", ids).eq("status", "menunggu"),
    db.from("tukar_shift").select("id", { count: "exact", head: true }).in("outlet_id", ids).eq("status", "menunggu_atasan"),
    db.from("jadwal_shift").select("id", { count: "exact", head: true }).in("outlet_id", ids).eq("status", "draft").gte("tanggal", today).lte("tanggal", addDays(today, 45)),
    ...cakupan.map(async (o) => {
      const [shifts, staf, jadwal, absensi, izin] = await Promise.all([
        muatShift(o.id), muatStaf(o.id),
        semua<Jadwal>((a, b) => db.from("jadwal_shift").select("id, shift_id, pengguna_id, tanggal, status").eq("outlet_id", o.id).eq("status", "terbit").gte("tanggal", dari).lte("tanggal", today).order("id").range(a, b)),
        semua<Absen>((a, b) => db.from("absensi").select("id, pengguna_id, jadwal_id, tanggal, masuk_at, pulang_at, status, telat_menit").eq("outlet_id", o.id).gte("tanggal", dari).lte("tanggal", today).order("id").range(a, b)),
        semua<Izin>((a, b) => db.from("pengajuan_izin").select("id, pengguna_id, tanggal, jenis").eq("outlet_id", o.id).eq("status", "disetujui").gte("tanggal", dari).lte("tanggal", today).order("id").range(a, b)),
      ]);
      const { baris } = hitungRekap({ shifts, jadwal, absensi, izin });
      const nama = Object.fromEntries(staf.map((x) => [x.id, x.nama]));
      const missing = [...new Set(baris.map((r) => r.pengguna_id).filter((id) => !nama[id]))];
      if (missing.length) {
        const { data: users, error } = await db.from("pengguna").select("id, nama").in("id", missing);
        if (error) throw new Error("Nama staf belum dapat dimuat.");
        for (const u of users ?? []) nama[u.id] = u.nama;
      }
      return { o, baris, nama };
    }),
  ]);
  if (ei || et || ed) throw new Error("Ringkasan pengajuan belum dapat dimuat.");
  const rows = data.flatMap((x) => x.baris);
  const harian = Array.from({ length: days }, (_, i) => {
    const tanggal = addDays(dari, i);
    return { tanggal, ...ringkasHrd(rows.filter((r) => r.tanggal === tanggal)) };
  });
  const now = rows.filter((r) => r.tanggal === today);
  const staff = data.flatMap((x) => x.baris.filter((r) => r.tanggal === today).map((r, i) => ({ key: `${x.o.id}-${r.pengguna_id}-${i}`, nama: x.nama[r.pengguna_id] ?? "Staf", outlet: x.o.nama, shift: r.shift?.nama ?? "Tanpa shift", mulai: r.shift?.jam_mulai ?? "", selesai: r.shift?.jam_selesai ?? "", status: r.status, masuk: r.absen?.masuk_at ?? null, pulang: r.absen?.pulang_at ?? null, telat: r.absen?.telat_menit ?? 0 })));
  return <>
    <LiveRefresh pantau={ids.flatMap((id) => ["absensi", "jadwal_shift", "pengajuan_izin", "tukar_shift"].map((table) => ({ table, filter: `outlet_id=eq.${id}` })))} cadanganDetik={60} />
    <HrdVisual outlets={outlets} selected={selected} days={days} today={today} summary={ringkasHrd(now)} trend={harian} comparison={data.map((x) => ({ nama: x.o.nama, ...ringkasHrd(x.baris.filter((r) => r.tanggal === today)) }))} staff={staff} actions={{ izin: izin ?? 0, tukar: tukar ?? 0, draft: draft ?? 0 }} />
  </>;
}
