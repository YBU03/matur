import Link from "next/link";
import { DASHBOARD_POS } from "@/lib/dashboard-navigation";
import { angka, rupiah } from "@/lib/chart-utils";
import { supabaseServer } from "@/lib/supabase/server";
import { rentang, type Ringkasan } from "./sales";

export async function RingkasPos() {
  const r = rentang("hari");
  const db = await supabaseServer();
  const { data, error } = await db.rpc("ringkasan_penjualan", {
    p_outlet: null,
    p_dari: r.dari,
    p_sampai: r.sampai,
    p_mode: "asli",
  });
  const k = (data as Ringkasan | null)?.kpi;
  return (
    <section className="rounded-2xl border border-matur-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold">Penjualan POS hari ini</h2>
          <p className="text-xs text-stone-500">
            Semua outlet · data transaksi asli
          </p>
        </div>
        <Link
          href={DASHBOARD_POS}
          className="rounded-lg bg-kopi-900 px-3 py-2 text-xs font-semibold text-white"
        >
          Buka Dashboard POS ›
        </Link>
      </div>
      {error || !k ? (
        <p role="status" className="mt-3 text-sm text-stone-500">
          Ringkasan belum dapat dimuat. Buka Dashboard POS untuk melihat detail.
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-stone-500">Omzet</p>
            <p className="text-lg font-bold">{rupiah(Number(k.omzet))}</p>
          </div>
          <div>
            <p className="text-xs text-stone-500">Transaksi</p>
            <p className="text-lg font-bold">{angka(k.trx)} struk</p>
          </div>
        </div>
      )}
    </section>
  );
}
