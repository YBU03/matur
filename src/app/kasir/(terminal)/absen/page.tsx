import { redirect } from "next/navigation";
import { addDays, hariIni } from "@/lib/jadwal/waktu";
import { muatAbsensi, muatJadwal, muatShift } from "@/lib/sdm";
import { getSession } from "@/lib/session";
import { AbsenView } from "./absen-view";

// Absen selfie + GPS: dari HP sendiri, atau di perangkat outlet (staf lain pakai kode staf + PIN).
export default async function AbsenPage() {
  const s = await getSession();
  if (!s?.active?.outletId) redirect("/pos");
  const outlet = s.active.outletId;
  const today = hariIni();
  const [shifts, jadwal, riwayat] = await Promise.all([
    muatShift(outlet),
    muatJadwal(outlet, today, today, s.userId),
    muatAbsensi(outlet, addDays(today, -13), today, s.userId),
  ]);
  const shiftById = new Map(shifts.map((x) => [x.id, x]));
  const terbuka = [...riwayat].reverse().find((a) => !a.pulang_at && Date.parse(a.masuk_at) > Date.now() - 20 * 3600_000);
  return (
    <AbsenView
      nama={s.nama}
      outletNama={s.active.outletNama}
      jadwalHariIni={jadwal
        .filter((j) => j.status === "terbit")
        .map((j) => ({ id: j.id, shift: shiftById.get(j.shift_id)!, sudah: riwayat.some((a) => a.jadwal_id === j.id) }))
        .filter((j) => j.shift)}
      terbuka={terbuka ? { masuk_at: terbuka.masuk_at } : null}
      riwayat={[...riwayat].reverse().map((a) => ({ id: a.id, tanggal: a.tanggal, masuk_at: a.masuk_at, pulang_at: a.pulang_at, status: a.status, telat_menit: a.telat_menit }))}
    />
  );
}
