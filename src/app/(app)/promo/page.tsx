import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { tglOperasional } from "@/lib/hari-operasional";
import type { Promo, PemakaianPromo, KuotaPromoHarian } from "@/lib/promo";
import { PromoPanel } from "./panel";
export default async function PromoPage({
  searchParams,
}: {
  searchParams: Promise<{ dari?: string; sampai?: string; outlet?: string }>;
}) {
  const s = await getSession();
  if (
    !s?.active ||
    !["owner", "admin_pusat", "admin_gudang", "hrd", "spv", "finance"].includes(
      s.active.role,
    )
  )
    notFound();
  const sp = await searchParams;
  const hari = tglOperasional();
  const valid = (x?: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(x ?? "") && Number.isFinite(Date.parse(x!));
  const dari = valid(sp.dari) ? sp.dari! : hari,
    sampai = valid(sp.sampai) ? sp.sampai! : hari;
  const o = s.active.role === "spv" ? s.active.outletId : sp.outlet || null;
  if (s.active.role === "spv" && !o) notFound();
  const db = await supabaseServer();
  const [promos, outlets, menus, variants, report, kategori, kuota] = await Promise.all([
    db.rpc("daftar_promo", { o, manajemen: true }),
    db.from("outlet").select("id,nama").is("deleted_at", null).order("nama"),
    db
      .from("menu")
      .select("id,nama,kemasan,harga_langsung,harga_ojol,kategori_id")
      .eq("aktif", true)
      .eq("mode", "asli")
      .is("deleted_at", null)
      .order("nama"),
    db
      .from("varian")
      .select("id,nama,grup,menu_id")
      .is("deleted_at", null)
      .order("nama"),
    db.rpc("laporan_promo", { o, d: dari, s: sampai }),
    db.from("kategori_menu").select("id,nama").eq("mode", "asli").is("deleted_at", null).order("urutan"),
    db.rpc("laporan_kuota_promo", { o, d: dari, s: sampai }),
  ]);
  return (
    <PromoPanel
      promos={(promos.data ?? []) as Promo[]}
      outlets={(outlets.data ?? []).filter(
        (x) => s.active!.role !== "spv" || x.id === o,
      )}
      menus={menus.data ?? []}
      variants={variants.data ?? []}
      laporan={(report.data ?? []) as PemakaianPromo[]}
      kategori={kategori.data ?? []}
      kuotaHarian={(kuota.data ?? []) as KuotaPromoHarian[]}
      error={
        promos.error?.message ||
        report.error?.message ||
        outlets.error?.message ||
        menus.error?.message ||
        variants.error?.message
      }
      bisaEdit={s.active.role !== "finance"}
      spv={s.active.role === "spv"}
      dari={dari}
      sampai={sampai}
      outlet={o ?? ""}
    />
  );
}
