import { redirect } from "next/navigation";
import { addDays, hariIni } from "@/lib/jadwal/waktu";
import { aturanSdm, muatIzin } from "@/lib/sdm";
import { getSession } from "@/lib/session";
import { IzinView } from "./izin-view";

// Pengajuan izin (min. H-3), sakit, dan libur mingguan (saat dibuka HRD) oleh kasir/barista.
export default async function IzinPage() {
  const s = await getSession();
  if (!s?.active?.outletId) redirect("/kasir");
  const today = hariIni();
  const [aturan, riwayat] = await Promise.all([aturanSdm(), muatIzin(s.active.outletId, addDays(today, -60), addDays(today, 120), { penggunaId: s.userId })]);
  return <IzinView today={today} aturan={aturan} riwayat={[...riwayat].sort((a, b) => b.created_at.localeCompare(a.created_at))} />;
}
