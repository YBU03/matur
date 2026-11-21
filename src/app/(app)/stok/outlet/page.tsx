import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { tglOperasional } from "@/lib/hari-operasional";
import {
  periodeStok,
  type BahanOutlet,
  type LaporanStokOutlet,
  type PermintaanStok,
  type TransferStok,
} from "@/lib/stok-outlet";
import { StokOutletView } from "./view";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    outlet?: string;
    awal?: string;
    akhir?: string;
    bahan?: string;
    tab?: string;
  }>;
}) {
  const s = await getSession();
  if (
    !s?.active ||
    ![
      "owner",
      "admin_pusat",
      "admin_gudang",
      "finance",
      "hrd",
      "spv",
      "manajer_area",
    ].includes(s.active.role)
  )
    notFound();
  const db = await supabaseServer();
  const sp = await searchParams;
  const { data: outlets, error: oe } = await db
    .from("outlet")
    .select("id,nama")
    .eq("mode", "asli")
    .is("deleted_at", null)
    .order("tgl_mulai");
  if (oe) throw new Error(oe.message);
  const personal = s.active.role === "spv";
  const daftar = personal
    ? (outlets ?? []).filter((o) => o.id === s.active!.outletId)
    : (outlets ?? []);
  if (!daftar.length) return <p>Belum ada outlet yang dapat diakses.</p>;
  const outlet =
    sp.outlet === "semua" && !personal
      ? null
      : (daftar.find((o) => o.id === sp.outlet)?.id ?? daftar[0].id);
  const { awal, akhir } = periodeStok(sp.awal, sp.akhir, tglOperasional());
  const bahan = /^[0-9a-f-]{36}$/.test(sp.bahan ?? "") ? sp.bahan! : null;
  let requestQuery = db
    .from("permintaan_stok_outlet")
    .select("*,kiriman(status,nomor)");
  let transferQuery = db.from("transfer_stok_terima").select("*");
  if (outlet) {
    requestQuery = requestQuery.eq("outlet_id", outlet);
    transferQuery = transferQuery.or(`asal.eq.${outlet},tujuan.eq.${outlet}`);
  }
  const [
    { data: report, error: re },
    { data: bs, error: be },
    { data: cfg, error: ce },
    { data: requests, error: qe },
    { data: transfers, error: te },
    { data: stok, error: se },
    { data: tujuan, error: de },
  ] = await Promise.all([
    db.rpc("laporan_stok_outlet", {
      p_outlet: outlet,
      p_awal: awal,
      p_akhir: akhir,
      p_bahan: bahan,
    }),
    db
      .from("bahan")
      .select("id,nama,satuan_pakai,stok_min")
      .eq("mode", "asli")
      .is("deleted_at", null)
      .order("nama"),
    outlet
      ? db
          .from("setelan_stok_outlet")
          .select("outlet_id,bahan_id,aktif,minimum")
          .eq("outlet_id", outlet)
      : Promise.resolve({ data: [], error: null }),
    requestQuery.order("created_at", { ascending: false }).limit(100),
    transferQuery.order("created_at", { ascending: false }).limit(100),
    outlet
      ? db
          .from("stok")
          .select("outlet_id,bahan_id,jumlah")
          .eq("mode", "asli")
          .eq("outlet_id", outlet)
      : Promise.resolve({ data: [], error: null }),
    db.rpc("tujuan_stok_outlet"),
  ]);
  const err = [re, be, ce, qe, te, se, de].find(Boolean);
  if (err) throw new Error(err.message);
  const pusat = ["owner", "admin_pusat", "admin_gudang"].includes(
    s.active.role,
  );
  return (
    <StokOutletView
      key={[outlet, awal, akhir, bahan, sp.tab].join(":")}
      outlets={daftar}
      tujuanOutlets={tujuan ?? []}
      stok={stok ?? []}
      outlet={outlet}
      awal={awal}
      akhir={akhir}
      hari={tglOperasional()}
      bahan={bs as BahanOutlet[]}
      pengaturan={cfg ?? []}
      data={report as LaporanStokOutlet}
      permintaan={requests as unknown as PermintaanStok[]}
      transfer={transfers as TransferStok[]}
      kelola={pusat || personal}
      pusat={pusat}
      bahanPilih={bahan}
      tabAwal={sp.tab}
    />
  );
}
