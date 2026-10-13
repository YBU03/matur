import Link from "next/link";
import { hitungRekap } from "@/lib/jadwal/rekap";
import { addDays, hariIni } from "@/lib/jadwal/waktu";
import { muatAbsensi, muatJadwal, muatShift, outletSdm } from "@/lib/sdm";
import type { Session } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

// Ringkasan SDM hari ini untuk HRD/Owner/SPV: kehadiran per outlet + hal yang perlu tindakan.
export async function RingkasSdm({ s }: { s: Session }) {
  const outlets = await outletSdm(s);
  if (!outlets.length) return null;
  const today = hariIni();
  const ids = outlets.map((o) => o.id);
  const supabase = await supabaseServer();
  const [{ count: izin }, { count: tukar }, { count: draft }, ...perOutlet] = await Promise.all([
    supabase.from("pengajuan_izin").select("id", { count: "exact", head: true }).in("outlet_id", ids).eq("status", "menunggu"),
    supabase.from("tukar_shift").select("id", { count: "exact", head: true }).in("outlet_id", ids).eq("status", "menunggu_atasan"),
    supabase.from("jadwal_shift").select("id", { count: "exact", head: true }).in("outlet_id", ids).eq("status", "draft").gte("tanggal", today).lte("tanggal", addDays(today, 45)),
    ...outlets.map(async (o) => {
      const [shifts, jadwal, absensi] = await Promise.all([muatShift(o.id), muatJadwal(o.id, today, today), muatAbsensi(o.id, today, today)]);
      const { baris } = hitungRekap({ shifts, jadwal: jadwal.filter((j) => j.status === "terbit"), absensi, izin: [] });
      return {
        o,
        jadwal: baris.filter((b) => b.shift).length,
        bertugas: baris.filter((b) => b.absen && !b.absen.pulang_at).length,
        telat: baris.filter((b) => b.status === "telat").length,
        tidak: baris.filter((b) => b.status === "tidak_absen").length,
        shift: shifts.length,
      };
    }),
  ]);
  const tindakan = [
    izin ? { href: "/persetujuan", teks: `${izin} pengajuan izin/libur menunggu` } : null,
    tukar ? { href: "/persetujuan", teks: `${tukar} tukar shift menunggu persetujuan` } : null,
    draft ? { href: "/jadwal", teks: `${draft} jadwal draft belum diterbitkan` } : null,
  ].filter((x): x is { href: string; teks: string } => !!x);

  return (
    <section className="space-y-3 rounded-2xl border border-matur-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold">Kehadiran hari ini</h2>
        <Link href="/absensi" className="text-sm font-semibold text-matur-700">
          Rekap absensi ›
        </Link>
      </div>
      {tindakan.map((t) => (
        <Link key={t.teks} href={t.href} className="block rounded-xl border-2 border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
          🔔 {t.teks}
        </Link>
      ))}
      <div className="grid gap-2 sm:grid-cols-2">
        {perOutlet.map((x) => (
          <Link key={x.o.id} href={`/absensi?outlet=${x.o.id}`} className="rounded-xl bg-matur-50 p-3 text-sm hover:bg-matur-100">
            <p className="font-semibold">{x.o.nama}</p>
            {x.shift ? (
              <p className="mt-1 text-stone-600">
                <b className="text-green-700">{x.bertugas}</b> bertugas · {x.jadwal} terjadwal · <b className="text-amber-700">{x.telat}</b> telat · <b className="text-red-600">{x.tidak}</b> tidak absen
              </p>
            ) : (
              <p className="mt-1 text-stone-500">Shift belum diatur → buka Jadwal Shift</p>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
