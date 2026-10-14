import { notFound } from "next/navigation";
import { BISA_JUAL } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { sesiAktif } from "@/lib/shift";
import { MulaiShift, type StafShift } from "./mulai-shift";
import { PosScreen, type Draft, type PosMenu } from "./pos-screen";

export default async function PosPage() {
  const s = await getSession();
  if (!s?.active?.outletId || !BISA_JUAL.includes(s.active.role)) notFound();
  const supabase = await supabaseServer();
  const sesi = await sesiAktif(supabase, s.active.outletId, s.userId);
  if (!sesi) {
    const { data: staf } = await supabase.rpc("staf_shift", { p_outlet: s.active.outletId });
    return <MulaiShift outletNama={s.active.outletNama} staf={(staf ?? []) as StafShift[]} meId={s.userId} meNama={s.nama} />;
  }

  const [{ data: kategori }, { data: menu }, { data: varian }, { data: pt }, { data: ol }, { data: draft }] = await Promise.all([
    supabase.from("kategori_menu").select("id, nama").eq("mode", "asli").is("deleted_at", null).order("urutan"),
    supabase.from("menu").select("id, nama, kategori_id, harga_langsung, harga_ojol, foto_url").eq("mode", "asli").is("deleted_at", null).eq("aktif", true).order("urutan").order("nama"),
    supabase.from("varian").select("id, menu_id, grup, nama, tambahan_harga").eq("mode", "asli").is("deleted_at", null),
    supabase.from("perusahaan").select("batas_diskon_persen").limit(1).maybeSingle(),
    supabase.from("outlet").select("qris_url, qris_payload, qris_nama, qris_dinamis").eq("id", s.active.outletId).maybeSingle(),
    supabase.from("pesanan_draft").select("id, label, kanal, tipe, pelanggan, meja, diskon, items, total, created_at, nama_pembuat").eq("outlet_id", s.active.outletId).eq("status", "draft").order("created_at"),
  ]);
  const menus: PosMenu[] = (menu ?? []).map((m) => ({ ...m, varian: (varian ?? []).filter((v) => v.menu_id === m.id) }));
  return <PosScreen kategori={kategori ?? []} menus={menus} outletNama={s.active.outletNama} kasir={sesi.nama_kasir ?? s.nama} batasDiskon={s.active.role === "spv" ? 100 : (pt?.batas_diskon_persen ?? 10)} drafts={(draft ?? []) as unknown as Draft[]} sesiId={sesi.id} qris={ol && (ol.qris_url || ol.qris_payload) ? { url: ol.qris_url, payload: ol.qris_payload, nama: ol.qris_nama, dinamis: ol.qris_dinamis } : null} />;
}
