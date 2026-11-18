import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { tglOperasional } from "@/lib/hari-operasional";
import { SubsidiPanel } from "./panel";
import type { TagihanSubsidi, MarketingDiskon } from "@/lib/subsidi";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ dari?: string; sampai?: string; outlet?: string }>;
}) {
  const s = await getSession();
  if (
    !s?.active ||
    !["owner", "admin_pusat", "finance"].includes(s.active.role)
  )
    notFound();
  const sp = await searchParams;
  const hari = tglOperasional();
  const valid = (x?: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(x ?? "") && Number.isFinite(Date.parse(x!));
  const dari = valid(sp.dari) ? sp.dari! : hari,
    sampai = valid(sp.sampai) ? sp.sampai! : hari;
  const o = sp.outlet || null;
  const db = await supabaseServer();
  const [r, ol, m] = await Promise.all([
    db.rpc("laporan_subsidi", { o, d: dari, s: sampai }),
    db
      .from("outlet")
      .select("id,nama")
      .eq("mode", "asli")
      .is("deleted_at", null)
      .order("nama"),
    db.rpc("laporan_marketing_diskon", { o, d: dari, s: sampai }),
  ]);
  return (
    <SubsidiPanel
      rows={(r.data ?? []) as TagihanSubsidi[]}
      marketing={(m.data ?? []) as MarketingDiskon[]}
      outlets={ol.data ?? []}
      dari={dari}
      sampai={sampai}
      outlet={o ?? ""}
      error={r.error?.message || m.error?.message || ol.error?.message}
    />
  );
}
