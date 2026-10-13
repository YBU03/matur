import { notFound } from "next/navigation";
import { MaintenanceToggle } from "@/components/maintenance-toggle";
import { KEBAL_MAINTENANCE, statusMaintenance } from "@/lib/maintenance";
import { getSession } from "@/lib/session";

// Saklar mode maintenance (hanya owner & admin pusat), dipakai bila perlu saja.
export default async function Maintenance() {
  const s = await getSession();
  if (!s?.active || !KEBAL_MAINTENANCE.includes(s.active.role)) notFound();
  const m = await statusMaintenance();
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Mode Maintenance</h1>
        <p className="text-sm text-stone-500">Saat aktif, semua pengguna (termasuk aplikasi POS kasir) melihat layar maintenance. Owner & admin pusat tetap bisa masuk.</p>
      </div>
      <MaintenanceToggle aktif={m.aktif} pesan={m.pesan} />
    </div>
  );
}
