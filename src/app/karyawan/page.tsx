import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { POS_ROLES, BISA_JUAL } from "@/lib/roles";
import { supabaseServer } from "@/lib/supabase/server";
import { hariIni, addDays } from "@/lib/jadwal/waktu";
import {
  muatAbsensi,
  muatJadwal,
  muatShift,
  muatIzin,
  urlFoto,
} from "@/lib/sdm";
import { hitungRekap } from "@/lib/jadwal/rekap";
import { AbsenView } from "@/app/kasir/(terminal)/absen/absen-view";
import { KehadiranGrafik } from "./grafik";
import { LiveRefresh } from "@/components/live-refresh";
import { GabungTim } from "./tim";
export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ rentang?: string }>;
}) {
  const s = await getSession();
  if (!s) redirect("/login");
  const tugas = s.assignments.filter(
    (a) => POS_ROLES.includes(a.role) && a.outletId,
  );
  if (!s.active?.outletId || !POS_ROLES.includes(s.active.role)) {
    const daftar = [...new Map(tugas.map((a) => [a.outletId, a])).values()];
    if (daftar.length === 1)
      redirect(`/karyawan/masuk?outlet=${daftar[0].outletId}`);
    return (
      <div className="mx-auto max-w-lg space-y-3">
        <h1 className="text-xl font-bold">Pilih outlet bertugas</h1>
        {daftar.map((a) => (
          <Link
            className="block rounded-xl border bg-white p-4"
            key={a.outletId}
            href={`/karyawan/masuk?outlet=${a.outletId}`}
          >
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
  const [shifts, jadwal, izin, absensi, { data: tim }] = await Promise.all([
    muatShift(o),
    muatJadwal(o, addDays(dari, -1), addDays(today, 7), s.userId),
    muatIzin(o, dari, today, { status: ["disetujui"], penggunaId: s.userId }),
    muatAbsensi(o, addDays(dari, -1), today, s.userId),
    db.rpc("ringkasan_tim_karyawan", { p_outlet: o }),
  ]);
  const rekap = hitungRekap({
    shifts,
    jadwal: jadwal.filter(
      (j) => j.status === "terbit" && j.tanggal >= dari && j.tanggal <= today,
    ),
    izin,
    absensi: absensi.filter((a) => a.tanggal >= dari),
  });
  const statistik = rekap.ringkas.find((r) => r.pengguna_id === s.userId);
  const shmap = new Map(shifts.map((sh) => [sh.id, sh]));
  const terbuka = absensi.find(
    (a) => !a.pulang_at && Date.parse(a.masuk_at) > Date.now() - 20 * 3600000,
  );
  const foto = await urlFoto(
    absensi.flatMap((a) => [a.masuk_foto, a.pulang_foto]),
  );
  return (
    <div className="space-y-5">
      <LiveRefresh
        pantau={[
          { table: "absensi", filter: `outlet_id=eq.${o}` },
          { table: "sesi_kas", filter: `outlet_id=eq.${o}` },
        ]}
        cadanganDetik={30}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-stone-500">Selamat bekerja,</p>
          <h1 className="text-2xl font-bold">{s.nama}</h1>
          <p className="text-sm text-stone-500">
            {s.active.outletNama} · {today}
          </p>
        </div>
        {BISA_JUAL.includes(s.active.role) && (
          <Link
            href="/kasir/pos"
            className="rounded-xl bg-kopi-900 px-4 py-3 font-semibold text-white"
          >
            🔒 Buka POS · khusus tablet outlet
          </Link>
        )}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_1.15fr]">
        <AbsenView
          nama={s.nama}
          outletNama={s.active.outletNama}
          jadwalHariIni={jadwal
            .filter(
              (j) =>
                j.status === "terbit" &&
                (j.tanggal === today || j.id === terbuka?.jadwal_id),
            )
            .map((j) => ({
              id: j.id,
              shift: shmap.get(j.shift_id)!,
              sudah: absensi.some((a) => a.jadwal_id === j.id),
            }))
            .filter((j) => j.shift)}
          terbuka={terbuka ? { masuk_at: terbuka.masuk_at } : null}
          riwayat={[...absensi].reverse()}
          foto={foto}
        />
        <div className="space-y-4">
          <KehadiranGrafik
            hari={rentang}
            tepat={statistik?.tepat ?? 0}
            telat={statistik?.telat ?? 0}
            izin={statistik?.izin ?? 0}
            alpa={statistik?.tidakAbsen ?? 0}
            menitTelat={statistik?.menitTelat ?? 0}
            baris={rekap.baris.map((b) => ({
              tanggal: b.tanggal,
              status: b.status,
              menit: b.absen?.telat_menit ?? 0,
            }))}
          />
          <section className="rounded-2xl border bg-white p-4">
            <h2 className="font-bold">Tim & jadwal hari ini</h2>
            <GabungTim
              data={tim ?? { jadwal: [], sesi: null }}
              saya={s.userId}
            />
          </section>
          <section className="rounded-2xl border bg-white p-4">
            <h2 className="font-bold">Jadwal saya berikutnya</h2>
            {jadwal
              .filter((j) => j.status === "terbit" && j.tanggal > today)
              .map((j) => (
                <p key={j.id} className="mt-2 border-t pt-2 text-sm">
                  {j.tanggal} · {shmap.get(j.shift_id)?.nama} ·{" "}
                  {shmap.get(j.shift_id)?.jam_mulai}–
                  {shmap.get(j.shift_id)?.jam_selesai}
                </p>
              ))}
            <Link
              className="mt-3 inline-block text-sm font-semibold underline"
              href="/karyawan/jadwal"
            >
              Lihat jadwal lengkap
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}
