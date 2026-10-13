import { notFound } from "next/navigation";
import { LiveRefresh } from "@/components/live-refresh";
import { currentMonth, monthRange } from "@/lib/jadwal/waktu";
import { aturanSdm, muatIzin, muatJadwal, muatShift, muatStaf, outletSdm, PENGELOLA_SDM } from "@/lib/sdm";
import { getSession } from "@/lib/session";
import { JadwalView } from "./jadwal-view";

// Jadwal shift outlet (konsep Makaryo): atur shift → susun draft otomatis → periksa → terbitkan.
export default async function JadwalPage({ searchParams }: { searchParams: Promise<{ outlet?: string; bulan?: string; tab?: string }> }) {
  const s = await getSession();
  if (!s?.active || !PENGELOLA_SDM.includes(s.active.role)) notFound();
  const sp = await searchParams;
  const outlets = await outletSdm(s);
  const outlet = outlets.find((o) => o.id === sp.outlet) ?? outlets[0];
  if (!outlet) notFound();
  const bulan = /^\d{4}-\d{2}$/.test(sp.bulan ?? "") ? sp.bulan! : currentMonth();
  const { start, end } = monthRange(bulan);
  const [shifts, staf, jadwal, izin, aturan] = await Promise.all([
    muatShift(outlet.id),
    muatStaf(outlet.id),
    muatJadwal(outlet.id, start, end),
    muatIzin(outlet.id, start, end, { status: ["menunggu", "disetujui"] }),
    aturanSdm(),
  ]);
  return (
    <>
      <LiveRefresh pantau={[{ table: "pengajuan_izin" }, { table: "tukar_shift" }]} cadanganDetik={120} />
      <JadwalView
        key={`${outlet.id}-${bulan}`}
        outlets={outlets.map((o) => ({ id: o.id, nama: o.nama }))}
        outlet={{ id: outlet.id, nama: outlet.nama, jam: outlet.jam_operasional }}
        bulan={bulan}
        tab={["shift", "staf", "aturan"].includes(sp.tab ?? "") ? sp.tab! : "kalender"}
        shifts={shifts}
        staf={staf}
        jadwal={jadwal}
        izin={izin}
        aturan={aturan}
        bisaAturan={s.active.role !== "spv"}
      />
    </>
  );
}
