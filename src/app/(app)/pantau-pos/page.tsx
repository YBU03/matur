import { notFound } from "next/navigation";
import { Kosong } from "@/components/ui-halaman";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { PantauView, selisihHari, tambah, tglRe, type Detail, type Ringkas } from "./view";

// Pemantau POS: satu halaman omzet harian, tren, menu terlaris, jam ramai/sepi. Data hanya lewat RPC pantau_pos*.

export default async function PantauPos({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const s = await getSession();
  if (s?.active?.role !== "pemantau_pos" && s?.active?.role !== "owner") notFound();
  const sp = await searchParams;
  const supabase = await supabaseServer();

  const { data: awal, error } = await supabase.rpc("pantau_pos_periode", { p_outlet: null });
  if (error || !awal) {
    return <Kosong ikon="🔒" judul="Data POS tidak bisa dimuat">{error?.message ?? "Coba muat ulang halaman."}</Kosong>;
  }
  const outlets = (awal as Ringkas).outlet;
  const outletId = outlets.length === 1 ? outlets[0].id : outlets.some((o) => o.id === sp.outlet) ? sp.outlet! : null;
  const ringkas = outletId ? ((await supabase.rpc("pantau_pos_periode", { p_outlet: outletId })).data as Ringkas | null) ?? (awal as Ringkas) : (awal as Ringkas);
  const hariIni = ringkas.hari_ini;

  // rentang detail: pilihan cepat atau kustom (maks. 400 hari)
  const rentang = sp.rentang ?? (tglRe.test(sp.dari ?? "") ? "kustom" : "30");
  let dari: string;
  let sampai = hariIni;
  if (rentang === "kustom" && tglRe.test(sp.dari ?? "") && tglRe.test(sp.sampai ?? "")) {
    [dari, sampai] = [sp.dari!, sp.sampai!].sort();
    if (sampai > hariIni) sampai = hariIni;
    if (dari > sampai) dari = sampai;
    if (selisihHari(dari, sampai) > 400) dari = tambah(sampai, -400);
  } else if (rentang === "7") dari = tambah(hariIni, -6);
  else if (rentang === "90") dari = tambah(hariIni, -89);
  else if (rentang === "bulan") dari = hariIni.slice(0, 8) + "01";
  else dari = tambah(hariIni, -29);

  const { data: det } = await supabase.rpc("pantau_pos", { p_outlet: outletId, p_dari: dari, p_sampai: sampai });
  const d = (det as Detail | null) ?? { kpi: { omzet: 0, trx: 0, diskon: 0, void: 0 }, harian: [], kanal: [], jam: [], menu: [], outlet: [] };
  return <PantauView ringkas={ringkas} d={d} outlets={outlets} outletId={outletId} rentang={rentang} dari={dari} sampai={sampai} hariIni={hariIni} />;
}
