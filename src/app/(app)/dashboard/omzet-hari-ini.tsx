import { KartuOmzet, type OmzetHariIni } from "@/components/kartu-omzet";
import { supabaseServer } from "@/lib/supabase/server";

// Kartu "Omzet hari ini" real-time (Owner & Admin Pusat: Beranda dan Dashboard POS).
export async function KartuOmzetHariIni({ outletId = null, outletNama, mode = "asli", tautan }: { outletId?: string | null; outletNama?: string; mode?: "asli" | "simulasi"; tautan?: { href: string; teks: string } }) {
  const db = await supabaseServer();
  const { data, error } = await db.rpc("omzet_hari_ini", { p_outlet: outletId, p_mode: mode });
  if (error || !data) {
    return <p role="status" className="rounded-2xl bg-matur-50 p-4 text-sm text-stone-500">Omzet hari ini belum dapat dimuat. Muat ulang halaman sebentar lagi.</p>;
  }
  const label = `${outletNama ?? "Semua outlet"}${mode === "simulasi" ? " · data simulasi" : ""}`;
  return <KartuOmzet d={data as OmzetHariIni} label={label} tautan={tautan} />;
}
