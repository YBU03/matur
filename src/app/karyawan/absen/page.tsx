import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { POS_ROLES } from "@/lib/roles";
import { hariIni, addDays } from "@/lib/jadwal/waktu";
import { muatAbsensi, muatJadwal, muatShift, urlFoto } from "@/lib/sdm";
import { JudulHalaman } from "@/components/staf/ui";
import { LiveRefresh } from "@/components/live-refresh";
import { AbsenView } from "@/app/kasir/(terminal)/absen/absen-view";

// Absen pribadi: kamera langsung + GPS wajib + catatan (alur absen_karyawan), di dalam Ruang Karyawan.
export default async function AbsenKaryawan() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!s.active?.outletId || !POS_ROLES.includes(s.active.role)) redirect("/karyawan");
  const o = s.active.outletId;
  const today = hariIni();
  const [shifts, jadwal, absensi] = await Promise.all([
    muatShift(o),
    muatJadwal(o, addDays(today, -1), today, s.userId),
    muatAbsensi(o, addDays(today, -30), today, s.userId),
  ]);
  const shmap = new Map(shifts.map((sh) => [sh.id, sh]));
  const terbuka = absensi.find((a) => !a.pulang_at && Date.parse(a.masuk_at) > Date.now() - 20 * 3600000);
  const foto = await urlFoto(absensi.flatMap((a) => [a.masuk_foto, a.pulang_foto]));
  return (
    <div className="mx-auto max-w-2xl">
      <LiveRefresh pantau={[{ table: "absensi", filter: `outlet_id=eq.${o}` }]} cadanganDetik={60} />
      <JudulHalaman judul="Absen" keterangan="Foto kamera + lokasi GPS, jam mengikuti server (WIB)." />
      <AbsenView
        nama={s.nama}
        outletNama={s.active.outletNama}
        jadwalHariIni={jadwal
          .filter((j) => j.status === "terbit" && (j.tanggal === today || j.id === terbuka?.jadwal_id))
          .map((j) => ({ id: j.id, shift: shmap.get(j.shift_id)!, sudah: absensi.some((a) => a.jadwal_id === j.id) }))
          .filter((j) => j.shift)}
        terbuka={terbuka ? { masuk_at: terbuka.masuk_at } : null}
        riwayat={[...absensi].reverse()}
        foto={foto}
      />
    </div>
  );
}
