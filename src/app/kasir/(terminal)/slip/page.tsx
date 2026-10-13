import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { SlipSaya, type SlipStaf } from "./slip-saya";

// Slip gaji milik staf yang sedang masuk (hanya bulan yang sudah final).
export default async function SlipPage() {
  const s = (await getSession())!;
  const supabase = await supabaseServer();
  const [{ data }, { data: pt }] = await Promise.all([
    supabase.from("slip_gaji").select("id, nama, jabatan, hadir, telat, tidak_absen, izin, pendapatan, potongan, total, rekening, penggajian:penggajian(periode, status, outlet:outlet(nama))").eq("pengguna_id", s.userId),
    supabase.from("perusahaan").select("nama, alamat, email, telepon").limit(1).maybeSingle(),
  ]);
  const slips = ((data ?? []) as unknown as (SlipStaf & { penggajian: { periode: string; status: string; outlet: { nama: string } | null } })[])
    .filter((x) => x.penggajian?.status === "final")
    .map((x) => ({ ...x, bulan: x.penggajian.periode.slice(0, 7), outlet: x.penggajian.outlet?.nama ?? "" }))
    .sort((a, b) => b.bulan.localeCompare(a.bulan));
  return <SlipSaya slips={slips} perusahaan={pt ?? { nama: "CV. Hazna Berkah Indonesia", alamat: null, email: null, telepon: null }} />;
}
