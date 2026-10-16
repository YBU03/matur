import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { Filters } from "../../dashboard/filters";
import { SalesDashboard } from "../../dashboard/sales";

// Mitra: penjualan POS outletnya sendiri (omzet harian, menu terlaris, kanal, jam ramai) — data lewat RLS.
export default async function PosMitra({
  searchParams,
}: {
  searchParams: Promise<{
    periode?: string;
    dari?: string;
    sampai?: string;
    outlet?: string;
  }>;
}) {
  const s = await getSession();
  if (s?.active?.role !== "mitra") notFound();
  const sp = await searchParams;
  const outlets = [
    ...new Map(
      s.assignments
        .filter((a) => a.role === "mitra" && a.outletId)
        .map((a) => [a.outletId!, { id: a.outletId!, nama: a.outletNama }]),
    ).values(),
  ];
  if (!outlets.length) notFound();
  const outletId =
    outlets.length === 1
      ? outlets[0].id
      : outlets.some((o) => o.id === sp.outlet)
        ? sp.outlet!
        : null;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">POS Outlet</h1>
        <p className="text-sm text-stone-500">
          Omzet & transaksi harian dari kasir{" "}
          {outlets.map((o) => o.nama).join(", ")} — diperbarui otomatis setiap
          transaksi.
        </p>
      </div>
      <Filters
        jenis="tanggal"
        outlets={outlets.length > 1 ? outlets : null}
        canSim={false}
      />
      <Suspense
        fallback={
          <div className="h-96 animate-pulse rounded-2xl bg-matur-50" />
        }
      >
        <SalesDashboard
          outlets={outlets}
          outletId={outletId}
          periode={sp.periode ?? "30"}
          kDari={sp.dari}
          kSampai={sp.sampai}
          mode="asli"
        />
      </Suspense>
    </div>
  );
}
