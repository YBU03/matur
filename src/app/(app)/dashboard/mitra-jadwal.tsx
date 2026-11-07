import { getSession } from "@/lib/session";
import { hariIni } from "@/lib/jadwal/waktu";
import { awalMingguMitra, type DataJadwalMitra } from "@/lib/mitra-jadwal";
import { supabaseServer } from "@/lib/supabase/server";
import { MitraJadwalView } from "./mitra-jadwal-view";

export async function MitraJadwal({ minggu, outlet }: { minggu?: string; outlet?: string }) {
  const s = await getSession();
  if (s?.active?.role !== "mitra" || s.status !== "aktif") return null;
  const today = hariIni();
  const awal = awalMingguMitra(minggu, today);
  const db = await supabaseServer();
  const { data, error } = await db.rpc("jadwal_mitra_mingguan", { p_awal: awal });
  if (error) return <section id="jadwal-mitra" className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><h2 className="font-bold">Jadwal Shift Mingguan</h2><p className="mt-2 text-sm">Jadwal belum dapat dimuat. Silakan segarkan halaman.</p></section>;
  return <MitraJadwalView data={data as DataJadwalMitra} awal={awal} today={today} outlet={outlet} />;
}
