import Link from "next/link";
import { bolehLihatJadwal } from "@/lib/jadwal-lihat";
import { notFound, redirect } from "next/navigation";
import { LiveRefresh } from "@/components/live-refresh";
import { hitungRekap } from "@/lib/jadwal/rekap";
import { hariIni } from "@/lib/jadwal/waktu";
import { muatAbsensi, muatIzin, muatJadwal, muatShift, muatStaf, outletSdm, PENGELOLA_SDM, urlFoto } from "@/lib/sdm";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { RekapView } from "./rekap-view";

// Rekap absensi: status hari ini, ringkasan per staf, dan detail (selfie, lokasi, jam kerja) + ekspor Excel.
export default async function AbsensiPage({ searchParams }: { searchParams: Promise<{ outlet?: string; dari?: string; sampai?: string; staf?: string }> }) {
  const s = await getSession();
  if (!s?.active) notFound();
  const sp = await searchParams;
  if (s.active.role === "admin_pusat") redirect(`/absensi/jadwal${sp.outlet ? `?outlet=${encodeURIComponent(sp.outlet)}` : ""}`);
  if (!PENGELOLA_SDM.includes(s.active.role)) notFound();
  const outlets = await outletSdm(s);
  const outlet = outlets.find((o) => o.id === sp.outlet) ?? outlets[0];
  if (!outlet) notFound();
  const today = hariIni();
  const tgl = (v: string | undefined, d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v ?? "") ? v! : d);
  const dari = tgl(sp.dari, `${today.slice(0, 8)}01`);
  const sampai = tgl(sp.sampai, today);
  const staf = sp.staf || undefined;

  const [shifts, daftarStaf, jadwal, izin, absensi, jadwalHariIni, absenHariIni, izinHariIni] = await Promise.all([
    muatShift(outlet.id),
    muatStaf(outlet.id),
    muatJadwal(outlet.id, dari, sampai, staf),
    muatIzin(outlet.id, dari, sampai, { status: ["disetujui"], penggunaId: staf }),
    muatAbsensi(outlet.id, dari, sampai, staf),
    muatJadwal(outlet.id, today, today),
    muatAbsensi(outlet.id, today, today),
    muatIzin(outlet.id, today, today, { status: ["disetujui"] }),
  ]);
  const terbit = jadwal.filter((j) => j.status === "terbit");
  const rekap = hitungRekap({ shifts, jadwal: terbit, absensi, izin });
  const hariIniRekap = hitungRekap({ shifts, jadwal: jadwalHariIni.filter((j) => j.status === "terbit"), absensi: absenHariIni, izin: izinHariIni });

  // nama staf yang sudah tidak bertugas tetap tampil (HRD/Owner bisa membaca tabel pengguna)
  const nama: Record<string, string> = Object.fromEntries(daftarStaf.map((x) => [x.id, x.nama]));
  const hilang = [...new Set([...absensi, ...absenHariIni].map((a) => a.pengguna_id).filter((id) => !nama[id]))];
  if (hilang.length) {
    const supabase = await supabaseServer();
    const { data } = await supabase.from("pengguna").select("id, nama").in("id", hilang);
    for (const u of data ?? []) nama[u.id] = u.nama;
  }
  const foto = await urlFoto([...absensi, ...absenHariIni].flatMap((a) => [a.masuk_foto, a.pulang_foto]));

  return (
    <>
      {bolehLihatJadwal(s.active.role) && <nav className="mx-auto mb-5 flex max-w-6xl gap-2" aria-label="Bagian rekap absensi"><span aria-current="page" className="rounded-xl bg-kopi-900 px-4 py-2 text-sm font-semibold text-white">Rekap Absensi</span><Link href={`/absensi/jadwal?outlet=${outlet.id}`} className="rounded-xl border border-matur-200 bg-white px-4 py-2 text-sm font-semibold text-kopi-700">Jadwal Shift</Link></nav>}
      <LiveRefresh pantau={[{ table: "absensi", filter: `outlet_id=eq.${outlet.id}` }]} cadanganDetik={60} />
      <RekapView
        outlets={outlets.map((o) => ({ id: o.id, nama: o.nama }))}
        outlet={{ id: outlet.id, nama: outlet.nama }}
        dari={dari}
        sampai={sampai}
        staf={staf ?? ""}
        daftarStaf={daftarStaf.map((x) => ({ id: x.id, nama: x.nama }))}
        nama={nama}
        rekap={rekap}
        hariIni={hariIniRekap.baris}
        absensi={Object.fromEntries([...absensi, ...absenHariIni].map((a) => [a.id, a]))}
        foto={foto}
      />
    </>
  );
}
