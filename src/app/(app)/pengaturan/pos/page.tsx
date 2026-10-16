import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { PanelPos, type PanelData } from "./view";
export default async function Page() {
  const s = await getSession();
  if (
    !s?.active ||
    !["owner", "hrd", "admin_gudang", "admin_pusat", "spv", "finance"].includes(
      s.active.role,
    )
  )
    notFound();
  const db = await supabaseServer();
  const { data, error } = await db.rpc("panel_pos_admin");
  if (error) throw new Error(error.message);
  return <PanelPos data={data as PanelData} role={s.active.role} />;
}
