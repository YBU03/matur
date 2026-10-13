import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { CatatanHarian, type Biaya, type Hari } from "./catatan-view";

const BOLEH = ["owner", "admin_pusat", "finance", "spv"];

// Catatan harian outlet (pengganti sheet "Transaksi" Ruma): penjualan per kanal dari POS, pengeluaran harian, setoran kas
export default async function CatatanHarianPage({ searchParams }: { searchParams: Promise<{ outlet?: string; bulan?: string; sim?: string }> }) {
  const s = await getSession();
  if (!s?.active || !BOLEH.includes(s.active.role)) notFound();
  const sp = await searchParams;
  const supabase = await supabaseServer();
  const { data: outlets } = await supabase.from("outlet").select("id, nama").eq("mode", "asli").is("deleted_at", null).order("tgl_mulai");
  const daftar = outlets ?? [];
  const outlet = (s.active.role === "spv" ? daftar.find((o) => o.id === s.active!.outletId) : daftar.find((o) => o.id === sp.outlet)) ?? daftar[0];
  if (!outlet) notFound();
  const bulan = /^\d{4}-\d{2}$/.test(sp.bulan ?? "") ? sp.bulan! : new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 7);
  const awal = `${bulan}-01`;
  const akhir = new Date(new Date(awal + "T00:00:00Z").setUTCMonth(new Date(awal + "T00:00:00Z").getUTCMonth() + 1)).toISOString().slice(0, 10);
  const sim = sp.sim === "1" && s.active.role === "owner";
  const mode = sim ? "simulasi" : "asli";
  const [{ data: hari }, { data: biaya }, { data: kat }] = await Promise.all([
    supabase.rpc("rekap_harian", { p_outlet: outlet.id, p_periode: awal, p_mode: mode }),
    supabase
      .from("biaya_outlet")
      .select("id, tanggal, kategori_id, jumlah, keterangan, sumber, created_at, pengguna:pengguna!biaya_outlet_dibuat_oleh_fkey(nama)")
      .eq("mode", mode)
      .eq("outlet_id", outlet.id)
      .gte("tanggal", awal)
      .lt("tanggal", akhir)
      .is("deleted_at", null)
      .order("created_at"),
    supabase.from("kategori_biaya").select("id, nama, grup, urutan").order("urutan"),
  ]);
  return (
    <CatatanHarian
      key={`${outlet.id}-${bulan}-${sim}`}
      outlets={s.active.role === "spv" ? [outlet] : daftar}
      outletId={outlet.id}
      bulan={bulan}
      sim={sim}
      bolehSim={s.active.role === "owner"}
      hari={(hari ?? []) as Hari[]}
      biaya={(biaya ?? []) as unknown as Biaya[]}
      kategori={(kat ?? []) as { id: string; nama: string; grup: string; urutan: number }[]}
    />
  );
}
