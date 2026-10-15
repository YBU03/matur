import { JudulHalaman } from "@/components/staf/ui";
import { menitKerja } from "@/lib/jadwal/rekap";
import { addDays, hariIni } from "@/lib/jadwal/waktu";
import { muatAbsensi, muatJadwal, muatShift, urlFoto } from "@/lib/sdm";
import { sesiStaf } from "@/lib/staf";
import { PanelAbsen } from "./panel-absen";

// Absen pribadi dari HP: kartu per shift hari ini, ringkasan bulan ini, riwayat 2 minggu.
export default async function AbsenStaf() {
  const { s, outlet } = await sesiStaf();
  const today = hariIni();
  const awalBulan = `${today.slice(0, 8)}01`;
  const [shifts, jadwalHariIni, jadwalBulan, absensi] = await Promise.all([
    muatShift(outlet),
    muatJadwal(outlet, today, today, s.userId),
    muatJadwal(outlet, awalBulan, today, s.userId),
    muatAbsensi(outlet, addDays(today, -31) < awalBulan ? addDays(today, -31) : awalBulan, today, s.userId),
  ]);
  const shift = new Map(shifts.map((x) => [x.id, x]));
  const hariIniAbsen = absensi.filter((a) => a.tanggal === today);
  const foto = await urlFoto(hariIniAbsen.flatMap((a) => [a.masuk_foto, a.pulang_foto]));
  const terbuka = [...absensi].reverse().find((a) => !a.pulang_at && Date.parse(a.masuk_at) > Date.now() - 20 * 3600_000) ?? null;
  const bulanIni = absensi.filter((a) => a.tanggal >= awalBulan);
  const ringkas = {
    jadwal: jadwalBulan.filter((j) => j.status === "terbit").length,
    hadir: bulanIni.length,
    tepat: bulanIni.filter((a) => a.status === "tepat").length,
    telat: bulanIni.filter((a) => a.status === "telat").length,
    menit: bulanIni.reduce((n, a) => n + menitKerja(a), 0),
  };
  const kartu = jadwalHariIni
    .filter((j) => j.status === "terbit" && shift.has(j.shift_id))
    .map((j) => ({ id: j.id, shift: shift.get(j.shift_id)!, absen: hariIniAbsen.find((a) => a.jadwal_id === j.id) ?? null }))
    .sort((a, b) => a.shift.jam_mulai.localeCompare(b.shift.jam_mulai));
  const tanpaJadwal = hariIniAbsen.filter((a) => !a.jadwal_id || !kartu.some((k) => k.id === a.jadwal_id));

  return (
    <>
      <JudulHalaman judul="Absen" keterangan="Selfie + lokasi, jam mengikuti server (WIB)." />
      <PanelAbsen
        kartu={kartu}
        tanpaJadwal={tanpaJadwal}
        terbukaId={terbuka?.id ?? null}
        foto={foto}
        ringkas={ringkas}
        riwayat={[...absensi].reverse().slice(0, 14)}
      />
    </>
  );
}
