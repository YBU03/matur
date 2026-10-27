import { notFound } from "next/navigation";
import { findMenu } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { StokView, type BahanStok } from "./stok-view";

export default async function StokGudangPage() {
  const s = await getSession();
  if (!s?.active || !findMenu(s.active.role, "/gudang/stok")) notFound();
  const supabase = await supabaseServer();
  const [{ data: bahan }, { data: stok }] = await Promise.all([
    supabase
      .from("bahan")
      .select("id, nama, kategori, satuan_beli, satuan_pakai, konversi, kemasan, harga_beli, harga_jual_gudang, harga_pokok, stok_min, catatan")
      .eq("mode", "asli")
      .is("deleted_at", null)
      .order("urutan")
      .order("nama"),
    supabase.from("stok").select("bahan_id, jumlah, updated_at").eq("mode", "asli").is("outlet_id", null),
  ]);
  const map = new Map((stok ?? []).map((x) => [x.bahan_id, x]));
  const rows: BahanStok[] = (bahan ?? []).map((b) => ({
    ...b,
    konversi: Number(b.konversi),
    harga_pokok: Number(b.harga_pokok),
    stok_min: Number(b.stok_min),
    jumlah: Number(map.get(b.id)?.jumlah ?? 0),
    updated_at: map.get(b.id)?.updated_at ?? null,
  }));
  return <StokView rows={rows} canEdit={["owner", "admin_pusat", "admin_gudang"].includes(s.active.role)} />;
}
