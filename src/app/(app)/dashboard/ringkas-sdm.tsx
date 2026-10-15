import Link from "next/link";
import { hitungRekap } from "@/lib/jadwal/rekap";
import { addDays, hariIni } from "@/lib/jadwal/waktu";
import { muatAbsensi, muatIzin, muatJadwal, muatShift, muatStaf, outletSdm } from "@/lib/sdm";
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
      const [shifts, jadwal, absensi, izinHariIni, staf] = await Promise.all([muatShift(o.id), muatJadwal(o.id, today, today), muatAbsensi(o.id, today, today), muatIzin(o.id, today, today, { status: ["disetujui"] }), muatStaf(o.id)]);
      const { baris } = hitungRekap({ shifts, jadwal: jadwal.filter((j) => j.status === "terbit"), absensi, izin: izinHariIni });
      const nama = Object.fromEntries(staf.map((x) => [x.id, x.nama]));
      const hilang = [...new Set(baris.map((b) => b.pengguna_id).filter((id) => !nama[id]))];
      if (hilang.length) {
        const { data } = await supabase.from("pengguna").select("id, nama").in("id", hilang);
        for (const u of data ?? []) nama[u.id] = u.nama;
      }
      return {
        o,
        baris, nama,
        hadir: baris.filter((b) => b.absen).length,
        tepat: baris.filter((b) => b.status === "tepat").length,
        jadwal: baris.filter((b) => b.shift).length,
        bertugas: baris.filter((b) => b.absen && !b.absen.pulang_at).length,
        telat: baris.filter((b) => b.status === "telat").length,
        tidak: baris.filter((b) => b.status === "tidak_absen").length,
        shift: shifts.length,
        belum: baris.filter((b) => b.status === "belum").length,
        izin: izinHariIni.length,
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
          <div key={x.o.id} className="rounded-xl bg-matur-50 p-3 text-sm">
            <Link href={`/absensi?outlet=${x.o.id}`} className="float-right text-matur-700 underline">Rekap ›</Link>
            <p className="font-semibold">{x.o.nama}</p>
            {x.shift ? (
              <p className="mt-1 text-stone-600">
                <b className="text-green-700">{x.hadir}</b> hadir · {x.bertugas} sedang bertugas · {x.jadwal} terjadwal · <b className="text-green-700">{x.tepat}</b> tepat waktu · {x.belum} belum absen · {x.izin} izin/sakit/libur · <b className="text-amber-700">{x.telat}</b> telat · <b className="text-red-600">{x.tidak}</b> tidak absen
              </p>
            ) : (
              <p className="mt-1 text-stone-500">Shift belum diatur → buka Jadwal Shift</p>
            )}
            <ul className="mt-3 divide-y divide-matur-200">
              {x.baris.map((b, i) => <li key={i} className="py-2">
                <p className="font-semibold">{x.nama[b.pengguna_id] ?? "Staf"}</p>
                <p className="text-xs text-stone-600">{b.shift ? `${b.shift.nama} · ${b.shift.jam_mulai}–${b.shift.jam_selesai}` : "Tanpa shift"}</p>
                <p className={`text-xs ${b.status === "telat" ? "text-amber-800" : b.status === "tepat" ? "text-green-800" : "text-stone-600"}`}>
                  {({ tepat: "Tepat waktu", telat: "Telat", belum: "Belum absen", tidak_absen: "Tidak absen", izin: "Izin", sakit: "Sakit", libur: "Libur", tanpa_jadwal: "Tanpa jadwal" })[b.status]}
                  {b.status === "telat" && ` ${b.absen?.telat_menit} menit`}
                  {b.absen && ` · Masuk ${new Date(b.absen.masuk_at).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" })}${b.absen.pulang_at ? ` · Pulang ${new Date(b.absen.pulang_at).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" })}` : " · Sedang bertugas"}`}
                </p>
              </li>)}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
