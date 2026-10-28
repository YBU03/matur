import { notFound, redirect } from "next/navigation";
import { BISA_JUAL } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { statusPos } from "@/lib/pos-tim";
import { MasukPos } from "@/app/pos/masuk-pos";
import {PosAlurShift} from "@/components/pos-alur-shift";
import { PosRuntime } from "@/components/pos-runtime";

import { type Draft, type PosMenu } from "./pos-screen";

export default async function PosPage() {
  const s = await getSession();
  if (!s?.active?.outletId || !BISA_JUAL.includes(s.active.role)) notFound();
  if(s.active.role!=="tablet")redirect("/pos");
  const supabase = await supabaseServer();
  const status = await statusPos(s.active.outletId).catch(()=>null);
  if(!status)return <MasukPos pesan="Sesi login outlet perlu diperbarui. Silakan masuk kembali."/>;
  if(status.alur_shift && !status.boleh)return <PosAlurShift status={status} outlet={s.active.outletNama}/>;
  const sesi = status.sesi!;

  const [
    { data: kategori },
    { data: menu },
    { data: varian },
    { data: pt },
    { data: ol },
    { data: draft },
  ] = await Promise.all([
    supabase
      .from("kategori_menu")
      .select("id, nama")
      .eq("mode", "asli")
      .is("deleted_at", null)
      .order("urutan"),
    supabase
      .from("menu")
      .select("id, nama, kategori_id, harga_langsung, harga_ojol, foto_url, induk_id, kemasan")
      .eq("mode", "asli")
      .is("deleted_at", null)
      .eq("aktif", true)
      .order("urutan")
      .order("nama"),
    supabase
      .from("varian")
      .select("id, menu_id, grup, nama, tambahan_harga")
      .eq("mode", "asli")
      .is("deleted_at", null),
    supabase
      .from("perusahaan")
      .select("batas_diskon_persen")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("outlet")
      .select("qris_url, qris_payload, qris_nama, qris_dinamis, qris_mode")
      .eq("id", s.active.outletId)
      .maybeSingle(),
    supabase
      .from("pesanan_draft")
      .select(
        "id, label, kanal, tipe, pelanggan, meja, diskon, items, total, created_at, nama_pembuat",
      )
      .eq("outlet_id", s.active.outletId)
      .eq("status", "draft")
      .order("created_at"),
  ]);
  const menus: PosMenu[] = (menu ?? [])
    .filter((m) => !!status.katalog?.menu[m.id])
    .map((m) => ({
      ...m,
      harga_langsung: status.katalog!.menu[m.id].langsung,
      harga_ojol: status.katalog!.menu[m.id].ojol,
      varian: (varian ?? [])
        .filter(
          (v) =>
            v.menu_id === m.id && status.katalog?.varian[v.id] !== undefined,
        )
        .map((v) => ({ ...v, tambahan_harga: status.katalog!.varian[v.id] })),
    }));
  return (
    <PosRuntime
      initial={{
        status,
        client_at: Date.now(),
        screen: {
          kategori: kategori ?? [],
          menus,
          outletNama: s.active.outletNama,
          kasir: sesi.nama,
          batasDiskon: pt?.batas_diskon_persen ?? 10,
          drafts: (draft ?? []) as unknown as Draft[],
          sesiId: sesi.id,
          qris:
            ol && (ol.qris_url || ol.qris_payload || ol.qris_mode === "dinamis")
              ? {
                  url: ol.qris_url,
                  payload: ol.qris_payload,
                  nama: ol.qris_nama,
                  dinamis: false,
                  mode: ol.qris_mode,
                }
              : null,
        },
      }}
    />
  );
}
