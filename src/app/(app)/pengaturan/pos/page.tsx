import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import type { AksesOutlet } from "./akses-outlet";
import { PanelPos, type PanelData } from "./view";
import { KasTertinggalPanel, type KasTertinggal } from "@/components/kas-tertinggal";
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
  const { data: akses, error: aksesError } = await db.rpc(
    "panel_akses_pos_outlet",
  );
  if (aksesError) throw new Error(aksesError.message);
  const allowed = (akses ?? []) as AksesOutlet[];
  const panel = data as PanelData;
  if (["hrd", "admin_gudang"].includes(s.active.role)) {
    const ids = new Set(allowed.map((x) => x.id));
    panel.outlets = panel.outlets.filter((x) => ids.has(x.id));
    panel.devices = panel.devices.filter((x) => ids.has(x.outlet_id));
    panel.sessions = panel.sessions.filter((x) => ids.has(x.outlet_id));
    panel.staf = panel.staf.filter((x) =>
      x.tugas?.some((t) => ids.has(t.outlet_id)),
    );
    panel.pindah = panel.pindah?.filter((x) =>
      panel.sessions.some((y) => y.id === x.sesi_id),
    );
  }
  const { data: tertinggal } = await db.rpc("kas_tertinggal");
  return (
    <div className="space-y-4">
      <KasTertinggalPanel list={(tertinggal ?? []) as KasTertinggal[]} />
      <PanelPos data={panel} role={s.active.role} akses={allowed} />
    </div>
  );
}
