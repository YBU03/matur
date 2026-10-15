import { notFound } from "next/navigation";
import { PilihOutlet } from "@/components/pilih-outlet";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { TitipanView, type RekapTitipan } from "./titipan-view";

const BOLEH = ["owner", "admin_pusat", "finance", "hrd", "admin_gudang", "spv", "manajer_area"];

// Produk titipan (cheesecake & dessert dari produsen): setoran masuk, terjual (otomatis dari POS), sisa, tagihan.
export default async function Titipan({ searchParams }: { searchParams: Promise<{ outlet?: string; bulan?: string }> }) {
  const s = await getSession();
  if (!s?.active || !BOLEH.includes(s.active.role)) notFound();
  const sp = await searchParams;
  const supabase = await supabaseServer();
  const { data: semua } = await supabase.from("outlet").select("id, nama").eq("mode", "asli").is("deleted_at", null).order("tgl_mulai");
  const outlets = s.active.role === "spv" ? (semua ?? []).filter((o) => o.id === s.active!.outletId) : (semua ?? []);
  const outlet = outlets.find((o) => o.id === sp.outlet) ?? outlets[0];
  if (!outlet) notFound();
  const bulan = /^\d{4}-\d{2}$/.test(sp.bulan ?? "") ? sp.bulan! : new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 7);
  const akhir = new Date(Date.UTC(Number(bulan.slice(0, 4)), Number(bulan.slice(5, 7)), 0)).toISOString().slice(0, 10);
  const [{ data: rekap }, { data: menu }, { data: riwayat }] = await Promise.all([
    supabase.rpc("rekap_titipan", { p_outlet: outlet.id, p_periode: `${bulan}-01` }),
    supabase.from("menu").select("id, nama, produsen, harga_titip").eq("mode", "asli").eq("titipan", true).is("deleted_at", null).order("nama"),
    supabase.from("titipan_masuk").select("id, menu_id, tanggal, qty, jenis, catatan, nama_pembuat, created_at").eq("outlet_id", outlet.id).gte("tanggal", `${bulan}-01`).lte("tanggal", akhir).order("created_at", { ascending: false }),
  ]);
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Titipan Produk</h1>
        <p className="text-sm text-stone-500">Barang titipan produsen (mis. Bu Ratna). Barang masuk tidak dibebankan — yang menjadi HPP hanya yang <b>terjual</b> (tercatat otomatis dari kasir) × harga produsen.</p>
      </div>
      <PilihOutlet outlets={outlets} pilih={outlet.id} href={(id) => `/titipan?outlet=${id}&bulan=${bulan}`} />
      <TitipanView outletId={outlet.id} bulan={bulan} rekap={(rekap ?? []) as RekapTitipan[]} menu={menu ?? []} riwayat={riwayat ?? []} />
    </div>
  );
}
