import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { OpnameView } from "./opname-view";

// Stok & opname outlet: hitung fisik akhir bulan → nilai persediaan akhir laporan
export default async function StokOutlet({ searchParams }: { searchParams: Promise<{ outlet?: string }> }) {
  const s = await getSession();
  if (!s?.active || !["owner", "admin_pusat", "admin_gudang", "spv"].includes(s.active.role)) notFound();
  const supabase = await supabaseServer();
  const { data: outlets } = await supabase.from("outlet").select("id, nama").eq("mode", "asli").is("deleted_at", null).order("tgl_mulai");
  const daftar = outlets ?? [];
  const sp = await searchParams;
  const outlet = (s.active.role === "spv" ? daftar.find((o) => o.id === s.active!.outletId) : daftar.find((o) => o.id === sp.outlet)) ?? daftar[0];
  if (!outlet) notFound();
  const [{ data: bahan }, { data: stok }, { data: riwayat }] = await Promise.all([
    supabase.from("bahan").select("id, nama, kategori, satuan_beli, satuan_pakai, konversi, harga_jual_gudang, harga_beli").eq("mode", "asli").is("deleted_at", null).order("urutan").order("nama"),
    supabase.from("stok").select("bahan_id, jumlah").eq("mode", "asli").eq("outlet_id", outlet.id),
    supabase.from("opname").select("id, tanggal, total_nilai, catatan, created_at").eq("mode", "asli").eq("outlet_id", outlet.id).order("created_at", { ascending: false }).limit(12),
  ]);
  const m = new Map((stok ?? []).map((x) => [x.bahan_id, Number(x.jumlah)]));
  return (
    <OpnameView
      key={outlet.id}
      outlets={s.active.role === "spv" ? [outlet] : daftar}
      outletId={outlet.id}
      bahan={(bahan ?? []).map((b) => {
        const konversi = Number(b.konversi) || 1;
        return { id: b.id, nama: b.nama, kategori: b.kategori, satuan_beli: b.satuan_beli, satuan_pakai: b.satuan_pakai, konversi, hargaPakai: Number(b.harga_jual_gudang || b.harga_beli || 0) / konversi, sistem: m.get(b.id) ?? 0 };
      })}
      riwayat={riwayat ?? []}
    />
  );
}
