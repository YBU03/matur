import { PosTestingPanel, type TestingOutlet } from "@/components/pos-testing-panel";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import type { AksesOutlet } from "./akses-outlet";
import { PanelPos, type PanelData } from "./view";
import Link from "next/link";
import {
  BarisAngka,
  ChipHeader,
  HeaderHalaman,
  KartuAngka,
  tombolHeader,
} from "@/components/ui-halaman";
import {
  KasTertinggalPanel,
  RiwayatKasOtomatis,
  type KasOtomatis,
  type KasTertinggal,
} from "@/components/kas-tertinggal";
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
  let testing: TestingOutlet[] = [];
  if (["owner", "admin_pusat"].includes(s.active.role)) {
    const { data, error } = await db.rpc("panel_testing_pos");
    if (error) throw new Error(error.message);
    testing = data ?? [];
  }
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
  const [{ data: tertinggal }, { data: otomatis }] = await Promise.all([
    db.rpc("kas_tertinggal"),
    db.rpc("riwayat_kas_otomatis"),
  ]);
  const sesiBuka = panel.sessions.filter((x) => !x.ditutup_at).length;
  const perangkatAktif = panel.devices.filter(
    (x) => x.status === "aktif",
  ).length;
  const aksesAktif = allowed.filter((x) => x.username && x.aktif).length;
  const pindahMenunggu = (panel.pindah ?? []).filter(
    (x) => !x.selesai_at && !x.batal_at,
  ).length;
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <HeaderHalaman
        ikon="🧾"
        judul="Akses Kasir POS per Outlet"
        keterangan="Satu akun POS dan satu kas harian per outlet. Modal sekali, serah terima PIC setiap pergantian shift."
        aksi={
          <Link href="/pengguna" className={tombolHeader}>
            👥 Kelola Pengguna Matoer
          </Link>
        }
      >
        <ChipHeader>{panel.outlets.length} outlet</ChipHeader>
        {sesiBuka > 0 && <ChipHeader>🟢 {sesiBuka} kas sedang buka</ChipHeader>}
        {pindahMenunggu > 0 && (
          <ChipHeader>⏳ {pindahMenunggu} pindah perangkat menunggu</ChipHeader>
        )}
      </HeaderHalaman>
      <BarisAngka>
        <KartuAngka
          ikon="🏪"
          label="Outlet"
          nilai={panel.outlets.length}
          sub="dalam kewenangan akun"
        />
        <KartuAngka
          ikon="🔐"
          label="Akun POS aktif"
          nilai={`${aksesAktif}/${allowed.length}`}
          sub="akses kasir outlet"
          nada="biru"
        />
        <KartuAngka
          ikon="📱"
          label="Perangkat aktif"
          nilai={`${perangkatAktif}/${panel.devices.length}`}
          sub="tablet & antrean"
          nada="ungu"
        />
        <KartuAngka
          ikon="💵"
          label="Kas harian buka"
          nilai={sesiBuka}
          sub={`${panel.sessions.length} sesi tercatat`}
          nada={sesiBuka ? "hijau" : "netral"}
        />
      </BarisAngka>
      <KasTertinggalPanel list={(tertinggal ?? []) as KasTertinggal[]} />
      <RiwayatKasOtomatis list={(otomatis ?? []) as KasOtomatis[]} />
      <PosTestingPanel rows={testing} />
      <PanelPos data={panel} role={s.active.role} akses={allowed} />
    </div>
  );
}
