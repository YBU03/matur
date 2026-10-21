import { KehadiranHariIni } from "./kehadiran-hari-ini";
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

  return <KehadiranHariIni outlets={perOutlet} tindakan={tindakan} />;
}
