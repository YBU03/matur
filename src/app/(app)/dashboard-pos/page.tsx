import Link from "next/link";
import { Suspense } from "react";
import { loadDashboardPos } from "@/lib/dashboard-pos";
import { LiveRefresh } from "@/components/live-refresh";
import { Filters } from "../dashboard/filters";
import { SalesDashboard } from "../dashboard/sales";
import { KartuOmzetHariIni } from "../dashboard/omzet-hari-ini";

export default async function DashboardPos({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { outlets, outletId, mode, error, sp } = await loadDashboardPos(
    await searchParams,
  );
  return (
    <div className="space-y-5">
      <LiveRefresh pantau={[{ table: "transaksi" }]} cadanganDetik={60} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dashboard POS</h1>
          <p className="mt-1 text-sm text-stone-500">
            Pantau omzet, transaksi, menu terlaris, dan kinerja outlet.
          </p>
        </div>
        <Link
          href="/laporan"
          className="rounded-xl border border-matur-200 bg-white px-4 py-2 text-sm font-semibold text-kopi-900"
        >
          Laporan Keuangan ›
        </Link>
      </div>
      {error ? (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">
          Daftar outlet belum dapat dimuat. Silakan muat ulang halaman.
        </p>
      ) : (
        <>
          <Suspense fallback={<div className="h-48 animate-pulse rounded-3xl bg-kopi-900/20" aria-busy="true" />}>
            <KartuOmzetHariIni outletId={outletId} outletNama={outlets.find((o) => o.id === outletId)?.nama} mode={mode} />
          </Suspense>
          <Filters outlets={outlets} canSim ringkasHp />
          <Suspense
            fallback={
              <div
                className="h-96 animate-pulse rounded-2xl bg-matur-50"
                aria-busy="true"
              />
            }
          >
            <SalesDashboard
              outlets={outlets}
              outletId={outletId}
              periode={sp.periode ?? "30"}
              kDari={sp.dari}
              kSampai={sp.sampai}
              mode={mode}
              ringkasHp
            />
          </Suspense>
        </>
      )}
    </div>
  );
}
