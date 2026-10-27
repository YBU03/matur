import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { OpnameGudang, type DraftGudang, type HitungGudang } from "./view";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const s = await getSession();
  if (
    !s?.active ||
    !["owner", "admin_pusat", "admin_gudang", "finance"].includes(s.active.role)
  )
    notFound();
  const db = await supabaseServer();
  const { id } = await searchParams;
  const { data: list, error } = await db
    .from("opname_gudang")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  const d = id
    ? (await db.from("opname_gudang").select("*").eq("id", id).maybeSingle())
        .data
    : null;
  if (id && !d) notFound();
  const items = d
    ? (
        await db
          .from("item_opname_gudang")
          .select("*")
          .eq("opname_id", d.id)
          .order("nama")
      ).data
    : [];
  return (
      <OpnameGudang
        key={d?.id + ":" + d?.versi}
        draft={d as DraftGudang | null}
        items={(items ?? []) as HitungGudang[]}
        list={(list ?? []) as DraftGudang[]}
        boleh={s.active.role !== "finance"}
      />
  );
}
