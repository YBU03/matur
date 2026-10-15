import { redirect } from "next/navigation";
import { PosGate } from "@/components/pos-gate";
import { TabletHeader } from "@/components/tablet-header";
import { AutoKunci } from "@/components/tablet-kunci";
import { BerandaTablet } from "./beranda";
import { MaintenanceScreen } from "@/components/maintenance-screen";
import { statusMaintenance } from "@/lib/maintenance";
import { infoTablet, statusPos } from "@/lib/pos-tim";
import { getSession } from "@/lib/session";
import { PasangTablet } from "./pasang-tablet";

export const dynamic = "force-dynamic";

// Satu alamat POS untuk semua cabang. Tablet dipasangkan sekali ke outlet, lalu staf membuka dengan kode staf + PIN.
export default async function PosHome() {
  const s = await getSession();
  const a = s?.active;
  if (!s || a?.role !== "tablet" || !a.outletId)
    return <PasangTablet akunSekarang={s?.nama} />;
  const m = await statusMaintenance();
  if (m.aktif) return <MaintenanceScreen pesan={m.pesan} />;
  const st = await statusPos(a.outletId);
  if (!st.device || st.device.status !== "aktif")
    return (
      <PasangTablet pesan="Akses tablet ini dicabut atau perangkat tidak dikenali. Pasangkan ulang oleh admin/SPV." />
    );
  if (st.mode === "antrean") redirect("/kasir/antrean");
  const info = infoTablet(st, a.outletNama);

  if (!st.boleh)
    return (
      <>
        <TabletHeader info={info} beranda />
        <main className="p-4">
          <PosGate
            status={st}
            outlet={a.outletNama}
            namaSaya={st.device.nama}
            saya=""
            tablet
          />
        </main>
      </>
    );

  return (
    <>
      <AutoKunci />
      <TabletHeader info={info} beranda />
      <BerandaTablet kasir={!!st.operator?.kasir} />
    </>
  );
}
