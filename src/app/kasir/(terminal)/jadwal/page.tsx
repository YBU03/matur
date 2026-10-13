import { redirect } from "next/navigation";
import { addDays, hariIni } from "@/lib/jadwal/waktu";
import { muatIzin, muatJadwal, muatShift, muatStaf } from "@/lib/sdm";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { AktifkanPush } from "@/components/aktifkan-push";
import { JadwalSaya } from "./jadwal-saya";

// Jadwal terbit untuk staf: milik sendiri + rekan satu outlet, dan tukar shift.
export default async function JadwalStafPage() {
  const s = await getSession();
  if (!s?.active?.outletId) redirect("/kasir");
  const outlet = s.active.outletId;
  const today = hariIni();
  const sampai = addDays(today, 34);
  const supabase = await supabaseServer();
  const [shifts, staf, jadwal, izin, { data: tukar }] = await Promise.all([
    muatShift(outlet),
    muatStaf(outlet),
    muatJadwal(outlet, today, sampai),
    muatIzin(outlet, today, sampai, { penggunaId: s.userId, status: ["menunggu", "disetujui"] }),
    supabase
      .from("tukar_shift")
      .select("id, pengaju_id, rekan_id, jadwal_pengaju, jadwal_rekan, alasan, status, alasan_tolak, created_at")
      .or(`pengaju_id.eq.${s.userId},rekan_id.eq.${s.userId}`)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  return (
    <div className="space-y-3">
    <div className="mx-auto max-w-3xl"><AktifkanPush /></div>
    <JadwalSaya
      saya={s.userId}
      today={today}
      shifts={shifts}
      nama={Object.fromEntries(staf.map((x) => [x.id, x.nama]))}
      jadwal={jadwal.filter((j) => j.status === "terbit")}
      izin={izin}
      tukar={tukar ?? []}
    />
    </div>
  );
}
