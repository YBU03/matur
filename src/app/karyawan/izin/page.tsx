import { redirect } from "next/navigation";
import { JudulHalaman } from "@/components/staf/ui";
import { addDays, hariIni } from "@/lib/jadwal/waktu";
import { POS_ROLES } from "@/lib/roles";
import { aturanSdm, muatIzin, muatJadwal, muatShift, muatStaf } from "@/lib/sdm";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { PengajuanStaf, type Tukar } from "./pengajuan-staf";

// Izin / sakit / libur mingguan dan tukar shift (pola halaman pengajuan & tukar shift host Makaryo).
export default async function IzinKaryawan({ searchParams }: { searchParams: Promise<{ tukar?: string }> }) {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!s.active?.outletId || !POS_ROLES.includes(s.active.role)) redirect("/karyawan");
  const outlet = s.active.outletId;
  const today = hariIni();
  const sp = await searchParams;
  const supabase = await supabaseServer();
  const [aturan, izin, shifts, staf, jadwal, { data: tukar }, { data: saya }] = await Promise.all([
    aturanSdm(),
    muatIzin(outlet, addDays(today, -60), addDays(today, 120), { penggunaId: s.userId }),
    muatShift(outlet),
    muatStaf(outlet),
    muatJadwal(outlet, addDays(today, -30), addDays(today, 45)),
    supabase
      .from("tukar_shift")
      .select("id, pengaju_id, rekan_id, jadwal_pengaju, jadwal_rekan, alasan, status, alasan_tolak, created_at")
      .or(`pengaju_id.eq.${s.userId},rekan_id.eq.${s.userId}`)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("pengguna").select("jatah_libur").eq("id", s.userId).maybeSingle(),
  ]);
  return (
    <>
      <JudulHalaman judul="Izin & Tukar" keterangan="Izin, sakit, libur mingguan, dan tukar shift." />
      <PengajuanStaf
        saya={s.userId}
        today={today}
        aturan={aturan}
        jatah={saya?.jatah_libur ?? aturan.jatah_libur_default}
        izin={[...izin].sort((a, b) => b.created_at.localeCompare(a.created_at))}
        shifts={shifts}
        nama={Object.fromEntries(staf.map((x) => [x.id, x.nama]))}
        jadwal={jadwal.filter((j) => j.status === "terbit")}
        tukar={(tukar ?? []) as Tukar[]}
        tukarAwal={sp.tukar ?? ""}
      />
    </>
  );
}
