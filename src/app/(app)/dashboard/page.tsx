import Image from "next/image";
import Link from "next/link";
import { CURRENT_STAGE, ROLES, type Role } from "@/lib/roles";
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

      {lihatPenjualan && (
        <SalesDashboard
          outlets={outlets}
          outletId={outletId}
          periode={sp.periode ?? "30"}
          mode={canSim && sp.mode === "simulasi" ? "simulasi" : "asli"}
          canPick={pusat}
          canSim={canSim}
        />
      )}
      {pusat && <ProjectsOverview />}
      {PROYEK.includes(active.role) && <ProjectDetailCharts />}

      <section>
        <h2 className="mb-3 font-semibold">Menu Anda</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {r.menu
            .filter((m) => m.href !== "/dashboard")
            .map((m) => (
              <Link
                key={m.href}
                href={m.href}
                className={`rounded-2xl border border-matur-200 p-4 shadow-sm hover:shadow-md ${m.stage <= CURRENT_STAGE ? "bg-white" : "bg-stone-50 opacity-70"}`}
              >
                <p className="font-semibold">{m.label}</p>
                <p className="text-xs text-stone-500">{m.stage <= CURRENT_STAGE ? "Tersedia" : "🔒 Segera hadir"}</p>
              </Link>
            ))}
        </div>
      </section>
    </div>
  );
}
