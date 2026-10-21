import { DASHBOARD_POS } from "@/lib/dashboard-navigation";
import { KartuOmzetHariIni } from "./omzet-hari-ini";

/** Beranda Owner/Admin Pusat: kartu omzet hari ini (real-time), detail lengkap di Dashboard POS. */
export async function RingkasPos() {
  return <KartuOmzetHariIni tautan={{ href: DASHBOARD_POS, teks: "Buka Dashboard POS" }} />;
}
