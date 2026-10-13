import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { MutasiView } from "./mutasi-view";

const GUDANG = ["owner", "admin_pusat", "admin_gudang"];

// Waste/barang rusak & transfer stok antar outlet. Gudang pusat: semua lokasi; SPV: outletnya.
export default async function Mutasi() {
  const s = await getSession();
  if (!s?.active || ![...GUDANG, "spv"].includes(s.active.role)) notFound();
  const gudang = GUDANG.includes(s.active.role);
  const supabase = await supabaseServer();
  const [{ data: outlets }, { data: bahan }, { data: stok }, { data: riwayat }] = await Promise.all([
    supabase.from("outlet").select("id, nama").eq("mode", "asli").is("deleted_at", null).order("nama"),
    supabase.from("bahan").select("id, nama, satuan_pakai, satuan_beli, konversi").eq("mode", "asli").is("deleted_at", null).order("nama"),
    supabase.from("stok").select("outlet_id, bahan_id, jumlah").eq("mode", "asli"),
    supabase.from("mutasi_stok").select("id, outlet_id, bahan_id, jumlah, jenis, keterangan, created_at").eq("mode", "asli").in("jenis", ["waste", "transfer_keluar", "transfer_masuk"]).order("created_at", { ascending: false }).limit(60),
  ]);
  const semua = outlets ?? [];
  const lokasi = gudang ? [{ id: "", nama: "Gudang pusat" }, ...semua] : semua.filter((o) => o.id === s.active!.outletId);
  return (
    <MutasiView
      lokasi={lokasi}
      outlets={semua}
      asalTransfer={gudang ? semua : semua.filter((o) => o.id === s.active!.outletId)}
      bahan={bahan ?? []}
      stok={(stok ?? []).map((x) => ({ ...x, jumlah: Number(x.jumlah) }))}
      riwayat={(riwayat ?? []).filter((r) => gudang || r.outlet_id === s.active!.outletId)}
    />
  );
}
