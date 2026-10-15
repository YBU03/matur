import { konteksOperasional, buktiUrls } from "@/lib/operasional-data";
import { SetoranView, type HariSetoran, type Setoran } from "./setoran-view";
export default async function SetoranPage({
  searchParams,
  terminal = false,
}: {
  searchParams: Promise<{ outlet?: string; dari?: string; sampai?: string }>;
  terminal?: boolean;
}) {
  const sp = await searchParams;
  const { s, db, outlet, outlets } = await konteksOperasional(
    "setoran",
    sp.outlet,
  );
  const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  const valid = (d?: string) => /^\d{4}-\d{2}-\d{2}$/.test(d ?? "");
  const dari = valid(sp.dari) ? sp.dari! : today.slice(0, 7) + "-01",
    sampai = valid(sp.sampai) ? sp.sampai! : today;
  const [rekap, riwayat] = await Promise.all([
    db.rpc("rekap_setoran", {
      p_outlet: outlet.id,
      p_dari: dari,
      p_sampai: sampai,
    }),
    db
      .from("setoran_omzet")
      .select("*,alokasi_setoran(tanggal,jumlah)")
      .eq("outlet_id", outlet.id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  if (riwayat.error) throw new Error("Riwayat setoran gagal dimuat.");
  const urls = await buktiUrls(
    db,
    (riwayat.data ?? []).map((x) => x.bukti_path),
  );
  return (
    <SetoranView
      key={`${outlet.id}:${dari}:${sampai}`}
      outlet={outlet}
      outlets={outlets}
      dari={dari}
      sampai={sampai}
      nama={s.nama}
      finance={["owner", "admin_pusat", "finance"].includes(s.active!.role)}
      base={terminal ? "/kasir/setoran" : "/setoran"}
      hari={(rekap.data ?? []) as HariSetoran[]}
      error={rekap.error?.message}
      riwayat={(riwayat.data ?? []) as Setoran[]}
      urls={urls}
    />
  );
}
