import { notFound } from "next/navigation";
import { StokRealtimeView } from "@/components/stok-realtime-view";
import { POS_ROLES } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { ambilStok, olah } from "@/lib/stok-realtime";
import { supabaseServer } from "@/lib/supabase/server";

// Stok outlet untuk kasir/barista/SPV: sisa bahan real-time setelah penjualan & per shift (tanpa nilai rupiah).
export default async function StokKasir() {
  const s = await getSession();
  if (!s?.active?.outletId || !POS_ROLES.includes(s.active.role)) notFound();
  const supabase = await supabaseServer();
  const d = await ambilStok(supabase, s.active.outletId);
  if (!d.data) return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{d.error}</p>;
  return (
    <StokRealtimeView
      judul="Stok Outlet"
      lokasi={[]}
      pilihan={s.active.outletId}
      basePath="/karyawan/stok"
      rows={olah(d.data)}
      shift={d.data.shift}
      tutupTerakhir={d.data.tutup_terakhir}
      tampilRp={false}
      pantau={[{ table: "stok", filter: `outlet_id=eq.${s.active.outletId}` }]}
    />
  );
}
