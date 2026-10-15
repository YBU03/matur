import { JudulHalaman } from "@/components/staf/ui";
import { addDays, hariIni } from "@/lib/jadwal/waktu";
import { aturanSdm, muatIzin, muatJadwal, muatShift, muatStaf } from "@/lib/sdm";
import { sesiStaf } from "@/lib/staf";
import { supabaseServer } from "@/lib/supabase/server";
import { PengajuanStaf, type Tukar } from "./pengajuan-staf";

// Pengajuan izin / sakit / libur mingguan dan tukar shift (pola halaman pengajuan & tukar shift host Makaryo).
export default async function PengajuanPage({ searchParams }: { searchParams: Promise<{ tukar?: string }> }) {
  const { s, outlet } = await sesiStaf();
  const today = hariIni();
  const sp = await searchParams;
  const supabase = await supabaseServer();
  const [aturan, izin, shifts, staf, jadwal, { data: tukar }] = await Promise.all([
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
  ]);
  return (
    <>
      <JudulHalaman judul="Pengajuan" keterangan="Izin, sakit, libur mingguan, dan tukar shift." />
      <PengajuanStaf
        saya={s.userId}
        today={today}
        aturan={aturan}
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
