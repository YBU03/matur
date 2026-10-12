import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { ROLES, type Role } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { ProjectDetailCharts, ProjectsOverview } from "./projects";
import { SalesDashboard } from "./sales";

const PUSAT: Role[] = ["owner", "admin_pusat", "finance", "manajer_area"];
const OUTLET: Role[] = ["spv"];
const PROYEK: Role[] = ["mitra", "pic"];

export default async function Dashboard({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const s = (await getSession())!;
  const active = s.active!;
  const r = ROLES[active.role];
  const sp = await searchParams;
  const pusat = PUSAT.includes(active.role);
  const lihatPenjualan = pusat || OUTLET.includes(active.role);
  const canSim = active.role === "owner" || active.role === "admin_pusat";

  let outlets: { id: string; nama: string }[] = [];
  if (lihatPenjualan) {
    const supabase = await supabaseServer();
    const { data } = await supabase.from("outlet").select("id, nama").eq("mode", "asli").is("deleted_at", null).order("nama");
    outlets = data ?? [];
  }
  let pendaftar = 0;
  if (canSim) {
    const supabase = await supabaseServer();
    const { count } = await supabase.from("pengguna").select("id", { count: "exact", head: true }).eq("status", "menunggu");
    pendaftar = count ?? 0;
  }
  const outletId = pusat ? (outlets.some((o) => o.id === sp.outlet) ? sp.outlet! : null) : active.outletId;

  return (
    <div className="space-y-6">
      <section className="flex items-center gap-5 overflow-hidden rounded-3xl bg-gradient-to-r from-matur-400 to-matur-600 p-5 text-white">
        <Image src={`/mascot/${r.mascot}.png`} alt="" width={96} height={96} priority className="hidden rounded-2xl sm:block" />
        <div>
          <p className="text-sm text-white/80">{r.label}</p>
          <h1 className="text-2xl font-bold sm:text-3xl">Sugeng rawuh, {s.nama}!</h1>
          <p className="mt-1 text-white/90">{active.outletNama}</p>
        </div>
      </section>

      {pendaftar > 0 && (
        <Link href="/pengguna" className="block rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          🔔 {pendaftar} pendaftar baru menunggu persetujuan → buka Pengguna & Akses
        </Link>
      )}

      {lihatPenjualan && (
        <Suspense fallback={<Skeleton h="h-96" />}>
        <SalesDashboard
          outlets={outlets}
          outletId={outletId}
          periode={sp.periode ?? "30"}
          mode={canSim && sp.mode === "simulasi" ? "simulasi" : "asli"}
          canPick={pusat}
          canSim={canSim}
        />
        </Suspense>
      )}
      {pusat && (
        <Suspense fallback={<Skeleton h="h-48" />}>
          <ProjectsOverview />
        </Suspense>
      )}
      {PROYEK.includes(active.role) && (
        <Suspense fallback={<Skeleton h="h-96" />}>
          <ProjectDetailCharts />
        </Suspense>
      )}

    </div>
  );
}

function Skeleton({ h }: { h: string }) {
  return <div className={`${h} animate-pulse rounded-2xl bg-matur-50`} aria-busy="true" />;
}
