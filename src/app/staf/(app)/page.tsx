import { formatRupiah } from "@/lib/format";
import { menitKerja } from "@/lib/jadwal/rekap";
import { addDays, hariIni } from "@/lib/jadwal/waktu";
import { BISA_JUAL } from "@/lib/roles";
import { muatAbsensi, muatJadwal, muatShift } from "@/lib/sdm";
import { sesiStaf } from "@/lib/staf";
import { BerandaView } from "./beranda-view";
import { supabaseServer } from "@/lib/supabase/server";

function sapaan() {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Jakarta" }).format(new Date()));
  return h < 11 ? "Selamat pagi" : h < 15 ? "Selamat siang" : h < 18 ? "Selamat sore" : "Selamat malam";
}

// Beranda staf: shift hari ini + tombol absen, statistik bulan ini, kartu modul (pola beranda host Makaryo).
export default async function BerandaStaf() {
  const { s, a, outlet } = await sesiStaf();
  const today = hariIni();
  const kasir = BISA_JUAL.includes(a.role);
  const supabase = await supabaseServer();
  const awalHariUtc = new Date(`${today}T00:00:00+07:00`).toISOString();

  const [shifts, jadwal, absensi, { count: tukarMasuk }, penjualan] = await Promise.all([
    muatShift(outlet),
    muatJadwal(outlet, today, addDays(today, 14), s.userId),
    muatAbsensi(outlet, `${today.slice(0, 8)}01`, today, s.userId),
    supabase.from("tukar_shift").select("id", { count: "exact", head: true }).eq("rekan_id", s.userId).eq("status", "menunggu_rekan"),
    kasir
      ? supabase.from("transaksi").select("total").eq("outlet_id", outlet).eq("dibuat_oleh", s.userId).eq("status", "lunas").eq("mode", "asli").gte("created_at", awalHariUtc)
      : supabase.from("transaksi").select("id", { count: "exact", head: true }).eq("outlet_id", outlet).eq("status", "lunas").eq("mode", "asli").in("status_pesanan", ["siap", "diambil"]).gte("created_at", awalHariUtc),
  ]);
  const shift = new Map(shifts.map((x) => [x.id, x]));
  const terbit = jadwal.filter((j) => j.status === "terbit" && shift.has(j.shift_id)).sort((x, y) => x.tanggal.localeCompare(y.tanggal) || shift.get(x.shift_id)!.jam_mulai.localeCompare(shift.get(y.shift_id)!.jam_mulai));
  const hariIniJ = terbit.filter((j) => j.tanggal === today);
  const berikut = terbit.filter((j) => j.tanggal > today).slice(0, 3);
  const absenHariIni = absensi.filter((x) => x.tanggal === today);
  const terbuka = [...absensi].reverse().find((x) => !x.pulang_at && Date.parse(x.masuk_at) > Date.now() - 20 * 3600_000);
  const utama = hariIniJ.find((j) => !absenHariIni.some((x) => x.jadwal_id === j.id)) ?? hariIniJ[0];
  const absenUtama = utama ? absenHariIni.find((x) => x.jadwal_id === utama.id) : absenHariIni[0];
  const sUtama = utama ? shift.get(utama.shift_id)! : null;

  const totalMenit = absensi.reduce((n, x) => n + menitKerja(x), 0);
  const tepat = absensi.filter((x) => x.status === "tepat").length;
  const telat = absensi.filter((x) => x.status === "telat").length;
  const keempat = kasir
    ? formatRupiah(((penjualan.data ?? []) as { total: number }[]).reduce((n, t) => n + Number(t.total), 0))
    : String(penjualan.count ?? 0);

  return (
    <BerandaView
      sapaan={sapaan()}
      nama={s.nama}
      outletNama={a.outletNama}
      sUtama={sUtama}
      jumlahShiftHariIni={hariIniJ.length}
      absenUtama={absenUtama ?? null}
      terbuka={!!terbuka}
      totalMenit={totalMenit}
      tepat={tepat}
      telat={telat}
      keempat={keempat}
      kasir={kasir}
      tukarMasuk={tukarMasuk ?? 0}
      berikut={berikut.map((j) => {
        const x = shift.get(j.shift_id)!;
        return { id: j.id, tanggal: j.tanggal, nama: x.nama, jam_mulai: x.jam_mulai, jam_selesai: x.jam_selesai };
      })}
    />
  );
}
