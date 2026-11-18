import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { tglOperasional } from "@/lib/hari-operasional";
import type { KuotaPromoHarian } from "@/lib/promo";
import { CampaignMitra, type PemakaianMitra, type PromoMitra } from "./campaign";

// Mitra: campaign & promo yang berlaku di outletnya sendiri (hanya baca) — lewat RPC promo_mitra.
export default async function PromoMitraPage({ searchParams }: { searchParams: Promise<{ outlet?: string; dari?: string; sampai?: string }> }) {
  const s = await getSession();
  if (s?.active?.role !== "mitra") notFound();
  const sp = await searchParams;
  const outlets = [...new Map(s.assignments.filter((a) => a.role === "mitra" && a.outletId).map((a) => [a.outletId!, { id: a.outletId!, nama: a.outletNama ?? "Outlet" }])).values()];
  if (!outlets.length) notFound();
  const outletId = outlets.some((o) => o.id === sp.outlet) ? sp.outlet! : outlets[0].id;
  const hari = tglOperasional();
  const valid = (x?: string) => /^\d{4}-\d{2}-\d{2}$/.test(x ?? "") && Number.isFinite(Date.parse(x!));
  const sampai = valid(sp.sampai) ? sp.sampai! : hari;
  const minus = (iso: string, n: number) => new Date(Date.parse(iso + "T00:00:00Z") - n * 86400_000).toISOString().slice(0, 10);
  let dari = valid(sp.dari) ? sp.dari! : minus(sampai, 6);
  if (dari > sampai || Date.parse(sampai) - Date.parse(dari) > 92 * 86400_000) dari = minus(sampai, 6);
  const db = await supabaseServer();
  const { data, error } = await db.rpc("promo_mitra", { o: outletId, d: dari, s: sampai });
  const v = (data ?? {}) as { hari_ini?: string; promo?: PromoMitra[]; kuota?: KuotaPromoHarian[]; pemakaian?: PemakaianMitra[] };
  return (
    <CampaignMitra
      outlets={outlets}
      outletId={outletId}
      dari={dari}
      sampai={sampai}
      hariIni={v.hari_ini ?? hari}
      promos={v.promo ?? []}
      kuota={v.kuota ?? []}
      pemakaian={v.pemakaian ?? []}
      error={error ? "Data campaign belum dapat dimuat. Coba muat ulang." : undefined}
    />
  );
}
