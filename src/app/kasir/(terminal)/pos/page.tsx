import { notFound } from "next/navigation";
import { BISA_JUAL } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { OpenShift, PosScreen, type PosMenu } from "./pos-screen";

export default async function PosPage() {
  const s = await getSession();
  if (!s?.active?.outletId || !BISA_JUAL.includes(s.active.role)) notFound();
  const supabase = await supabaseServer();
  const { data: sesi } = await supabase
    .from("sesi_kas")
    .select("id, modal_laci, dibuka_at")
    .eq("mode", "asli")
    .eq("outlet_id", s.active.outletId)
    .eq("kasir_id", s.userId)
    .is("ditutup_at", null)
    .maybeSingle();
  if (!sesi) return <OpenShift outletNama={s.active.outletNama} />;

  const [{ data: kategori }, { data: menu }, { data: varian }, { data: pt }] = await Promise.all([
    supabase.from("kategori_menu").select("id, nama").eq("mode", "asli").is("deleted_at", null).order("urutan"),
    supabase.from("menu").select("id, nama, kategori_id, harga_langsung, harga_ojol, foto_url").eq("mode", "asli").is("deleted_at", null).eq("aktif", true).order("urutan").order("nama"),
    supabase.from("varian").select("id, menu_id, grup, nama, tambahan_harga").eq("mode", "asli").is("deleted_at", null),
    supabase.from("perusahaan").select("batas_diskon_persen").limit(1).maybeSingle(),
  ]);
  const menus: PosMenu[] = (menu ?? []).map((m) => ({ ...m, varian: (varian ?? []).filter((v) => v.menu_id === m.id) }));
  return <PosScreen kategori={kategori ?? []} menus={menus} outletNama={s.active.outletNama} kasir={s.nama} batasDiskon={s.active.role === "spv" ? 100 : (pt?.batas_diskon_persen ?? 10)} />;
}
