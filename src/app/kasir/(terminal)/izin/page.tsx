import { redirect } from "next/navigation";
import { addDays, hariIni } from "@/lib/jadwal/waktu";
import { aturanSdm, muatIzin } from "@/lib/sdm";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { IzinView } from "./izin-view";

// Pengajuan izin (min. H-3), sakit, dan libur mingguan (saat dibuka HRD) oleh kasir/barista.
export default async function IzinPage() {
  const s = await getSession();
  if (!s?.active?.outletId) redirect("/kasir");
  const today = hariIni();
  const supabase = await supabaseServer();
  const [aturan, riwayat, { data: saya }] = await Promise.all([
    aturanSdm(),
    muatIzin(s.active.outletId, addDays(today, -60), addDays(today, 120), { penggunaId: s.userId }),
    supabase.from("pengguna").select("jatah_libur").eq("id", s.userId).maybeSingle(),
  ]);
  return <IzinView today={today} aturan={aturan} jatah={saya?.jatah_libur ?? aturan.jatah_libur_default} riwayat={[...riwayat].sort((a, b) => b.created_at.localeCompare(a.created_at))} />;
}
