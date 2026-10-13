import { notFound } from "next/navigation";
import { POS_ROLES } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { KasView, type Catatan } from "./kas-view";

// Kas & pengeluaran harian outlet (sheet "Transaksi" Ruma): catat pengeluaran, lihat ringkasan shift, tutup shift
export default async function KasPage() {
  const s = await getSession();
  if (!s?.active?.outletId || !POS_ROLES.includes(s.active.role)) notFound();
  const outlet = s.active.outletId;
  const supabase = await supabaseServer();
  const hari = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  const [{ data: kat }, { data: sesiSaya }, { data: sesiBuka }, { data: catatan }] = await Promise.all([
    supabase.from("kategori_biaya").select("id, nama, grup").eq("harian", true).order("urutan"),
    supabase.from("sesi_kas").select("id, modal_laci, dibuka_at").eq("mode", "asli").eq("outlet_id", outlet).eq("kasir_id", s.userId).is("ditutup_at", null).maybeSingle(),
    supabase.from("sesi_kas").select("id").eq("mode", "asli").eq("outlet_id", outlet).is("ditutup_at", null).limit(1),
    supabase
      .from("biaya_outlet")
      .select("id, tanggal, kategori_id, jumlah, keterangan, sumber, sesi_kas_id, dibuat_oleh, created_at, pengguna:pengguna!biaya_outlet_dibuat_oleh_fkey(nama)")
      .eq("mode", "asli")
      .eq("outlet_id", outlet)
      .eq("tanggal", hari)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
  ]);
  // ringkasan shift milik kasir ini: penjualan tunai & non tunai, pengeluaran dari laci
  let ringkas: { tunai: number; nonTunai: number; laci: number; transaksi: number } | null = null;
  if (sesiSaya) {
    const [{ data: trx }, { data: laci }] = await Promise.all([
      supabase.from("transaksi").select("id, total, pembayaran(metode, nominal)").eq("sesi_kas_id", sesiSaya.id).eq("status", "lunas"),
      supabase.from("biaya_outlet").select("jumlah").eq("sesi_kas_id", sesiSaya.id).eq("sumber", "laci").is("deleted_at", null),
    ]);
    const bayar = (trx ?? []).flatMap((t) => (t.pembayaran as unknown as { metode: string; nominal: number }[]) ?? []);
    ringkas = {
      tunai: bayar.filter((p) => p.metode === "tunai").reduce((a, p) => a + Number(p.nominal), 0),
      nonTunai: bayar.filter((p) => p.metode !== "tunai").reduce((a, p) => a + Number(p.nominal), 0),
      laci: (laci ?? []).reduce((a, x) => a + Number(x.jumlah), 0),
      transaksi: (trx ?? []).length,
    };
  }
  return (
    <KasView
      kategori={(kat ?? []) as { id: string; nama: string; grup: string }[]}
      catatan={(catatan ?? []) as unknown as Catatan[]}
      meId={s.userId}
      sesi={sesiSaya ? { id: sesiSaya.id, modal: Number(sesiSaya.modal_laci), dibuka: sesiSaya.dibuka_at } : null}
      adaShiftBuka={(sesiBuka ?? []).length > 0}
      ringkas={ringkas}
      outletNama={s.active.outletNama}
      spv={s.active.role === "spv"}
    />
  );
}
