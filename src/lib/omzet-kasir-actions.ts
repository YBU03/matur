"use server";

// Kartu kecil "Hari ini" di layar Kasir — sumber sama dengan ringkasan Riwayat (transaksi lunas hari operasional ini).
import { awalOperasional, tglOperasional } from "@/lib/hari-operasional";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

export async function omzetKasirHariIni(): Promise<{ transaksi: number; omzet: number } | null> {
  const s = await getSession();
  const outlet = s?.active?.outletId;
  if (!outlet) return null;
  const hari = tglOperasional();
  const besok = new Date(Date.parse(hari + "T00:00:00Z") + 86400_000).toISOString().slice(0, 10);
  const supabase = await supabaseServer();
  let transaksi = 0;
  let omzet = 0;
  for (let dari = 0; dari < 20_000; dari += 1000) {
    const { data, error } = await supabase
      .from("transaksi")
      .select("total")
      .eq("mode", "asli")
      .eq("outlet_id", outlet)
      .eq("status", "lunas")
      .gte("created_at", awalOperasional(hari))
      .lt("created_at", awalOperasional(besok))
      .order("id")
      .range(dari, dari + 999);
    if (error) return null;
    for (const t of data ?? []) {
      transaksi++;
      omzet += Number(t.total) || 0;
    }
    if (!data || data.length < 1000) break;
  }
  return { transaksi, omzet };
}
