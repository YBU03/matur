import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { buktiTablet } from "@/lib/pos-tim";
import { PosLogout } from "@/components/pos-logout";
import { MasukPos } from "../masuk-pos";
import { TestingKasir } from "./testing-kasir";
import type { SimMenu } from "@/lib/pos-simulasi";
import { statusMaintenance } from "@/lib/maintenance";
import { MaintenanceScreen } from "@/components/maintenance-screen";
export const dynamic = "force-dynamic";
export default async function Page() {
  const s = await getSession();
  if (s?.active?.role !== "tablet" || !s.active.outletId) redirect("/pos");
  const maintenance = await statusMaintenance();
  if (maintenance.aktif)
    return <MaintenanceScreen pesan={maintenance.pesan} pos />;
  const db = await supabaseServer();
  const { data: active, error: se } = await db.rpc("status_testing_pos", {
    p_outlet: s.active.outletId,
  });
  if (se) throw new Error(se.message);
  if (!active) redirect("/pos");
  const proof = await buktiTablet();
  const { data, error } = await db.rpc("katalog_testing_pos", {
    p_outlet: s.active.outletId,
    p_device: proof.device,
  });
  if (error)
    return (
      <MasukPos pesan="Akses testing perlu login POS ulang. Gunakan username dan password outlet yang masih aktif." />
    );
  return (
    <main className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-amber-400 bg-amber-50 p-4">
        <div>
          <p className="font-bold text-amber-950">
            MODE TESTING POS · {s.active.outletNama}
          </p>
          <p className="mt-1 text-sm text-amber-900">
            Tanpa jadwal / Clock In. Bukan transaksi asli; tidak mengubah kas,
            omzet, stok, setoran, atau laporan.
          </p>
        </div>
        <PosLogout label="Keluar POS" />
      </header>
      <TestingKasir
        menu={(data ?? []) as SimMenu[]}
        outletNama={s.active.outletNama}
      />
    </main>
  );
}
