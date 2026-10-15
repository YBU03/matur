import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { POS_ROLES, BISA_JUAL } from "@/lib/roles";
import { supabaseServer } from "@/lib/supabase/server";
import { hariIni, addDays } from "@/lib/jadwal/waktu";
import { muatAbsensi, muatJadwal, muatShift, muatIzin } from "@/lib/sdm";
import { hitungRekap, menitKerja } from "@/lib/jadwal/rekap";
import { LiveRefresh } from "@/components/live-refresh";
import { Kartu, KepalaKartu } from "@/components/staf/ui";
import { KehadiranGrafik } from "./grafik";
import { GabungTim } from "./tim";
import { BerandaView } from "./beranda-view";

function sapaan() {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Jakarta" }).format(new Date()));
  return h < 11 ? "Selamat pagi" : h < 15 ? "Selamat siang" : h < 18 ? "Selamat sore" : "Selamat malam";
}

// Beranda Ruang Karyawan (pola beranda host Makaryo): kartu shift hari ini + tombol absen,
// statistik, kartu modul, grafik kehadiran, tim & POS hari ini, shift berikutnya.
export default async function Dashboard({ searchParams }: { searchParams: Promise<{ rentang?: string }> }) {
  const s = await getSession();
  if (!s) redirect("/login");
  const tugas = s.assignments.filter((a) => POS_ROLES.includes(a.role) && a.outletId);
  if (!s.active?.outletId || !POS_ROLES.includes(s.active.role)) {
    const daftar = [...new Map(tugas.map((a) => [a.outletId, a])).values()];
    if (daftar.length === 1) redirect(`/karyawan/masuk?outlet=${daftar[0].outletId}`);
    return (
      <div className="mx-auto max-w-lg space-y-3">
        <h1 className="text-xl font-bold text-kopi-900">Pilih outlet bertugas</h1>
        {daftar.map((a) => (
          <Link className="block rounded-[var(--radius-kartu)] border border-garis bg-white p-4 font-semibold text-kopi-900 shadow-[var(--shadow-kartu)]" key={a.outletId} href={`/karyawan/masuk?outlet=${a.outletId}`}>
            {a.outletNama}
          </Link>
        ))}
      </div>
    );
  }
  const o = s.active.outletId;
  const today = hariIni();
  const rentang = (await searchParams).rentang === "7" ? 7 : 30;
  const dari = addDays(today, -rentang + 1);
  const db = await supabaseServer();
  const [shifts, jadwal, izin, absensi, { data: tim }, { count: tukarMasuk }] = await Promise.all([
    muatShift(o),
    muatJadwal(o, addDays(dari, -1), addDays(today, 14), s.userId),
    muatIzin(o, dari, today, { status: ["disetujui"], penggunaId: s.userId }),
    muatAbsensi(o, addDays(dari, -1), today, s.userId),
    db.rpc("ringkasan_tim_karyawan", { p_outlet: o }),
    db.from("tukar_shift").select("id", { count: "exact", head: true }).eq("rekan_id", s.userId).eq("status", "menunggu_rekan"),
  ]);
  const rekap = hitungRekap({
    shifts,
    jadwal: jadwal.filter((j) => j.status === "terbit" && j.tanggal >= dari && j.tanggal <= today),
    izin,
    absensi: absensi.filter((a) => a.tanggal >= dari),
  });
  const statistik = rekap.ringkas.find((r) => r.pengguna_id === s.userId);
  const shift = new Map(shifts.map((x) => [x.id, x]));
  const terbit = jadwal
    .filter((j) => j.status === "terbit" && shift.has(j.shift_id))
    .sort((x, y) => x.tanggal.localeCompare(y.tanggal) || shift.get(x.shift_id)!.jam_mulai.localeCompare(shift.get(y.shift_id)!.jam_mulai));
  const hariIniJ = terbit.filter((j) => j.tanggal === today);
  const absenHariIni = absensi.filter((x) => x.tanggal === today);
  const terbuka = absensi.find((a) => !a.pulang_at && Date.parse(a.masuk_at) > Date.now() - 20 * 3600000);
  const utama = hariIniJ.find((j) => !absenHariIni.some((x) => x.jadwal_id === j.id)) ?? hariIniJ[0];
  const absenUtama = utama ? absenHariIni.find((x) => x.jadwal_id === utama.id) : absenHariIni[0];

  return (
    <>
      <LiveRefresh
        pantau={[
          { table: "absensi", filter: `outlet_id=eq.${o}` },
          { table: "sesi_kas", filter: `outlet_id=eq.${o}` },
        ]}
        cadanganDetik={30}
      />
      <BerandaView
        sapaan={sapaan()}
        nama={s.nama}
        outletNama={s.active.outletNama}
        sUtama={utama ? shift.get(utama.shift_id)! : null}
        jumlahShiftHariIni={hariIniJ.length}
        absenUtama={absenUtama ?? null}
        terbuka={!!terbuka}
        totalMenit={absensi.filter((a) => a.tanggal >= dari).reduce((n, a) => n + menitKerja(a), 0)}
        tepat={statistik?.tepat ?? 0}
        telat={statistik?.telat ?? 0}
        keempat={String(statistik?.izin ?? 0)}
        keempatLabel="Izin, sakit & libur"
        labelPeriode={`${rentang} hari`}
        kasir={BISA_JUAL.includes(s.active.role)}
        tukarMasuk={tukarMasuk ?? 0}
        berikut={terbit
          .filter((j) => j.tanggal > today)
          .slice(0, 3)
          .map((j) => {
            const x = shift.get(j.shift_id)!;
            return { id: j.id, tanggal: j.tanggal, nama: x.nama, jam_mulai: x.jam_mulai, jam_selesai: x.jam_selesai };
          })}
        tambahan={
          <div className="mb-4 grid gap-4 lg:grid-cols-2">
            <KehadiranGrafik
              hari={rentang}
              tepat={statistik?.tepat ?? 0}
              telat={statistik?.telat ?? 0}
              izin={statistik?.izin ?? 0}
              alpa={statistik?.tidakAbsen ?? 0}
              menitTelat={statistik?.menitTelat ?? 0}
              baris={rekap.baris.map((b) => ({ tanggal: b.tanggal, status: b.status, menit: b.absen?.telat_menit ?? 0 }))}
            />
            <Kartu>
              <KepalaKartu judul="Tim & jadwal hari ini" keterangan="Satu sesi kas POS untuk satu tim." />
              <GabungTim data={tim ?? { jadwal: [], sesi: null }} saya={s.userId} />
            </Kartu>
          </div>
        }
      />
    </>
  );
}
