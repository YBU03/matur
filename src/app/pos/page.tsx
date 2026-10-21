import { redirect } from "next/navigation";
import { TabletHeader } from "@/components/tablet-header";
import { AutoKunci } from "@/components/tablet-kunci";
import { MaintenanceScreen } from "@/components/maintenance-screen";
import { PosLogout } from "@/components/pos-logout";
import { statusMaintenance } from "@/lib/maintenance";
import { infoTablet, statusPos } from "@/lib/pos-tim";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { BerandaTablet } from "./beranda";
import { PosOutletPic } from "@/components/pos-outlet-pic";
import { MasukPos } from "./masuk-pos";

export const dynamic = "force-dynamic";

// One outlet credential, separate browser identities, and a shared daily drawer.
export default async function PosHome() {
  const s = await getSession();
  const a = s?.active;
  if (!s || a?.role !== "tablet" || !a.outletId) return <MasukPos />;
  const m = await statusMaintenance();
  if (m.aktif) return <MaintenanceScreen pesan={m.pesan} pos />;
  const st = await statusPos(a.outletId);
  if (!st.device || st.device.status !== "aktif")
    return (
      <MasukPos pesan="Tablet ini belum aktif atau aksesnya dicabut. Masuk lagi dengan username/password outlet; bila dicabut, hubungi HRD/Admin Gudang." />
    );
  const testDb = await supabaseServer();
  const { data: testing, error: testError } = await testDb.rpc("status_testing_pos", { p_outlet: a.outletId });
  if (testError) throw new Error(testError.message);
  if (testing) redirect("/pos/testing");
  if (st.mode === "antrean") redirect("/kasir/antrean");
  const info = infoTablet(st, a.outletNama);

  if (!st.boleh)
    return (
      <>
        <TabletHeader info={info} beranda />
        <PosOutletPic status={st} outlet={a.outletNama} />
        <div className="mx-auto mt-4 flex max-w-md justify-center">
          <PosLogout label="Keluar / ganti outlet tablet" />
        </div>
      </>
    );

  const sesi = st.sesi!;
  const db = await supabaseServer();
  const [{ count: draft }, { count: antrean }, { data: item }] =
    await Promise.all([
      db
        .from("pesanan_draft")
        .select("id", { count: "exact", head: true })
        .eq("outlet_id", a.outletId)
        .eq("status", "draft"),
      db
        .from("transaksi")
        .select("id", { count: "exact", head: true })
        .eq("sesi_kas_id", sesi.id)
        .eq("status", "lunas")
        .neq("status_pesanan", "diambil"),
      db
        .from("item_transaksi")
        .select("nama, qty, transaksi!inner(sesi_kas_id, status)")
        .eq("transaksi.sesi_kas_id", sesi.id)
        .eq("transaksi.status", "lunas")
        .limit(2000),
    ]);
  const jumlah = new Map<string, number>();
  for (const i of item ?? [])
    jumlah.set(i.nama, (jumlah.get(i.nama) ?? 0) + i.qty);
  const terlaris = [...jumlah.entries()]
    .sort((x, y) => y[1] - x[1])
    .slice(0, 5)
    .map(([nama, qty]) => ({ nama, qty }));

  return (
    <>
      <AutoKunci />
      <TabletHeader info={info} beranda />
      <details className="mx-auto max-w-xl p-3">
        <summary className="cursor-pointer font-semibold">
          Ganti PIC / Serah terima shift
        </summary>
        <PosOutletPic status={st} outlet={a.outletNama} />
      </details>
      <BerandaTablet
        kasir={!!st.operator?.kasir}
        d={{
          operator: st.operator?.nama ?? null,
          outlet: a.outletNama,
          shift: info.shift,
          bukaAt: sesi.buka_at,
          batasAt: sesi.batas_at,
          modal: sesi.modal,
          omzet: st.omzet?.total ?? 0,
          jumlah: st.omzet?.jumlah ?? 0,
          draft: draft ?? 0,
          antrean: antrean ?? 0,
          tim: info.tim,
          terlaris,
        }}
      />
    </>
  );
}
