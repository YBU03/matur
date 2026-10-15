import { redirect } from "next/navigation";
import { PosGate } from "@/components/pos-gate";
import { TabletHeader } from "@/components/tablet-header";
import { AutoKunci } from "@/components/tablet-kunci";
import { BerandaTablet } from "./beranda";
import { MaintenanceScreen } from "@/components/maintenance-screen";
import { statusMaintenance } from "@/lib/maintenance";
import { infoTablet, statusPos } from "@/lib/pos-tim";
import { getSession } from "@/lib/session";
import { PosLogout } from "@/components/pos-logout";
import { MasukPos } from "./masuk-pos";

export const dynamic = "force-dynamic";

// Satu alamat POS untuk semua cabang: staf masuk dengan kode staf + PIN, tablet mengikuti outlet tempat staf bertugas.
export default async function PosHome({
  searchParams,
}: {
  searchParams: Promise<{ kode?: string }>;
}) {
  const kode = (await searchParams).kode ?? "";
  const s = await getSession();
  const a = s?.active;
  if (!s || a?.role !== "tablet" || !a.outletId) return <MasukPos />;
  const m = await statusMaintenance();
  if (m.aktif) return <MaintenanceScreen pesan={m.pesan} />;
  const st = await statusPos(a.outletId);
  if (!st.device || st.device.status !== "aktif")
    return (
      <MasukPos pesan="Tablet ini belum aktif atau aksesnya dicabut. Masuk lagi dengan kode staf + PIN; bila dicabut, hubungi HRD/Admin Gudang." />
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
            kodeAwal={kode}
          />
          <div className="mx-auto mt-4 flex max-w-xl justify-center">
            <PosLogout label="Keluar / ganti outlet tablet" />
          </div>
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
