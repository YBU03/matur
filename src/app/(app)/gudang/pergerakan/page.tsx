import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import type { BahanForecast, BulanData } from "@/lib/gudang-forecast";
import { PergerakanView, type Gerak } from "./view";

const TGL = /^\d{4}-\d{2}-\d{2}$/;
const PERAN = ["owner", "admin_pusat", "admin_gudang", "finance"];
const geser = (iso: string, hari: number) => new Date(Date.parse(iso + "T00:00:00Z") + hari * 86400_000).toISOString().slice(0, 10);

// Pergerakan stok Gudang (harian/mingguan/bulanan) & Smart Forecast kebutuhan bulan depan.
export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string; grain?: string; dari?: string; sampai?: string; outlet?: string }> }) {
  const s = await getSession();
  if (!s?.active || !PERAN.includes(s.active.role)) notFound();
  const sp = await searchParams;
  const tab = sp.tab === "forecast" ? "forecast" : "pergerakan";
  const grain = sp.grain === "hari" || sp.grain === "minggu" ? sp.grain : "bulan";
  const hari = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  let sampai = TGL.test(sp.sampai ?? "") ? sp.sampai! : hari;
  if (sampai > hari) sampai = hari;
  let dari = TGL.test(sp.dari ?? "") ? sp.dari! : grain === "hari" ? geser(sampai, -29) : geser(hari.slice(0, 7) + "-01", -1).slice(0, 7) + "-01";
  if (dari > sampai) dari = sampai;
  const maks = grain === "hari" ? 92 : 366;
  if (geser(dari, maks) < sampai) dari = geser(sampai, -maks);
  const outlet = sp.outlet && /^[0-9a-f-]{36}$/.test(sp.outlet) ? sp.outlet : "";

  const db = await supabaseServer();
  const [{ data: bahan }, { data: outlets }, data] = await Promise.all([
    db.from("bahan").select("id, nama, kategori, satuan_beli, satuan_pakai, konversi, harga_beli, stok_min").eq("mode", "asli").is("deleted_at", null).order("urutan").order("nama"),
    db.from("outlet").select("id, nama").eq("mode", "asli").is("deleted_at", null).order("nama"),
    tab === "forecast"
      ? db.rpc("forecast_stok", { p_outlet: outlet || null, p_bulan: 4 })
      : db.rpc("pergerakan_stok_gudang", { p_awal: dari, p_akhir: sampai, p_grain: grain }),
  ]);
  const listBahan: BahanForecast[] = (bahan ?? []).map((b) => ({
    ...b,
    konversi: Number(b.konversi) || 1,
    harga_beli: Number(b.harga_beli) || 0,
    stok_min: Number(b.stok_min) || 0,
  }));
  return (
    <PergerakanView
      key={[tab, grain, dari, sampai, outlet].join(":")}
      tab={tab}
      grain={grain}
      dari={dari}
      sampai={sampai}
      hari={hari}
      outlet={outlet}
      outlets={outlets ?? []}
      bahan={listBahan}
      bisaUbah={["owner", "admin_pusat", "admin_gudang"].includes(s.active.role)}
      error={data.error?.message ?? ""}
      gerak={tab === "pergerakan" ? ((data.data ?? null) as Gerak | null) : null}
      forecast={
        tab === "forecast" && data.data
          ? (data.data as { bulan: BulanData[]; stok_gudang: Record<string, number>; stok_outlet: Record<string, number>; awal_data: string | null; hari_ini: string; buffer: number })
          : null
      }
    />
  );
}
