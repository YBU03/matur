import {
  PenerimaanBelanja,
  type BelanjaBahan,
} from "@/components/penerimaan-belanja";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StokRealtimeView } from "@/components/stok-realtime-view";
import { POS_ROLES } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { ambilStok, ambilTitipan, olah } from "@/lib/stok-realtime";
import { supabaseServer } from "@/lib/supabase/server";

// Stok outlet untuk kasir/barista/SPV: sisa bahan real-time setelah penjualan & per shift (tanpa nilai rupiah).
export default async function StokKasir() {
  const s = await getSession();
  if (!s?.active?.outletId || !POS_ROLES.includes(s.active.role)) notFound();
  const supabase = await supabaseServer();
  const { data: belanja, error: belanjaError } = await supabase
    .from("belanja_bahan_outlet")
    .select("*")
    .eq("outlet_id", s.active.outletId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (belanjaError) throw new Error(belanjaError.message);
  const [d, titipan] = await Promise.all([
    ambilStok(supabase, s.active.outletId),
    ambilTitipan(supabase, s.active.outletId),
  ]);
  if (!d.data)
    return (
      <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
        {d.error}
      </p>
    );
  return (
    <div className="space-y-4">
      <Link
        href={
          s.active.role === "tablet"
            ? "/kasir/stok/opname"
            : "/karyawan/stok/opname"
        }
        className="inline-flex rounded-xl bg-kopi-900 px-4 py-3 font-semibold text-white"
      >
        Hitung stok / SO Outlet
      </Link>
      <PenerimaanBelanja data={(belanja ?? []) as BelanjaBahan[]} />
      <StokRealtimeView
        judul="Stok Outlet"
        lokasi={[]}
        pilihan={s.active.outletId}
        basePath={s.active.role === "tablet" ? "/kasir/stok" : "/karyawan/stok"}
        rows={olah(d.data)}
        shift={d.data.shift}
        tutupTerakhir={d.data.tutup_terakhir}
        tampilRp={false}
        pantau={[
          { table: "stok", filter: `outlet_id=eq.${s.active.outletId}` },
          {
            table: "titipan_masuk",
            filter: `outlet_id=eq.${s.active.outletId}`,
          },
        ]}
        titipan={titipan}
      />
    </div>
  );
}
