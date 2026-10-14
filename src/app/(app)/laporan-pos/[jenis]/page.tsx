import { notFound } from "next/navigation";
import { LAPORAN, PERAN_GUDANG, PERAN_LAPORAN, rentangPreset, tabBoleh, tglWib } from "@/lib/laporan-pos";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { LaporanView } from "./laporan-view";

const tglOk = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

export default async function LaporanPos({ params, searchParams }: { params: Promise<{ jenis: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { jenis } = await params;
  const lap = LAPORAN[jenis];
  const s = await getSession();
  if (!lap || !s?.active || !PERAN_LAPORAN.includes(s.active.role) || !tabBoleh(s.active.role).includes(lap.tab)) notFound();
  const sp = await searchParams;
  const supabase = await supabaseServer();
  const peran = s.active.role;
  const bisaGudang = PERAN_GUDANG.includes(peran) && lap.lingkup !== "outlet";
  const { data: semua } = await supabase.from("outlet").select("id, nama").eq("mode", "asli").is("deleted_at", null).order("tgl_mulai");
  const outlets = lap.lingkup === "gudang" ? [] : peran === "spv" ? (semua ?? []).filter((o) => o.id === s.active!.outletId) : (semua ?? []);
  // pilihan: id outlet atau "gudang"
  const pilihan = sp.outlet === "gudang" && bisaGudang ? "gudang" : (outlets.find((o) => o.id === sp.outlet)?.id ?? (lap.lingkup === "gudang" || (peran === "admin_gudang" && bisaGudang) ? "gudang" : (outlets[0]?.id ?? "gudang")));
  const hari = tglWib();
  const [d0, s0] = rentangPreset(sp.preset ?? (lap.tanggal === "per" ? "hari_ini" : "bulan_ini"), hari);
  const sampai = tglOk(sp.sampai) ?? s0;
  const dari = lap.tanggal === "per" ? sampai : (tglOk(sp.dari) ?? d0);
  const sim = sp.sim === "1" && peran === "owner";

  const { data: bahan } = lap.bahan ? await supabase.from("bahan").select("id, nama, satuan_pakai").eq("mode", "asli").is("deleted_at", null).order("nama") : { data: null };
  const bahanId = lap.bahan && bahan?.some((b) => b.id === sp.bahan) ? sp.bahan! : null;

  let rows: Record<string, unknown>[] = [];
  let err: string | null = null;
  if (lap.bahan !== "wajib" || bahanId) {
    const { data, error } = await supabase.rpc("laporan_operasional", {
      p_jenis: jenis,
      p_outlet: pilihan === "gudang" ? null : pilihan,
      p_dari: dari > sampai ? sampai : dari,
      p_sampai: sampai,
      p_mode: sim ? "simulasi" : "asli",
      p_bahan: bahanId,
    });
    if (error) err = error.message.replace(/^.*?ERROR:\s*/, "");
    rows = (data ?? []) as Record<string, unknown>[];
  }
  const namaTempat = pilihan === "gudang" ? "Gudang Pusat" : (outlets.find((o) => o.id === pilihan)?.nama ?? "");

  return (
    <LaporanView
      key={`${jenis}-${pilihan}-${dari}-${sampai}-${bahanId}-${sim}`}
      jenis={jenis}
      outlets={outlets}
      bisaGudang={bisaGudang}
      pilihan={pilihan}
      namaTempat={namaTempat}
      dari={dari}
      sampai={sampai}
      hariIni={hari}
      bahan={bahan ?? []}
      bahanId={bahanId}
      rows={rows}
      err={err}
      sim={sim}
      bolehSim={peran === "owner"}
    />
  );
}
