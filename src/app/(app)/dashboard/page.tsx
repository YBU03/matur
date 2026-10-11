import Image from "next/image";
import Link from "next/link";
import { outletName } from "@/lib/demo-data";
import { ROLES } from "@/lib/roles";
import { getSession } from "@/lib/session";

export default async function Dashboard() {
  const s = (await getSession())!;
  const active = s.active!;
  const r = ROLES[active.role];

  return (
    <div className="space-y-6">
      <section className="flex items-center gap-5 overflow-hidden rounded-3xl bg-gradient-to-r from-matur-400 to-matur-600 p-6 text-white">
        <Image src={`/mascot/${r.mascot}.png`} alt="" width={120} height={120} priority className="hidden rounded-2xl sm:block" />
        <div>
          <p className="text-sm text-white/80">{r.label}</p>
          <h1 className="text-2xl font-bold sm:text-3xl">Sugeng rawuh, {s.user.nama}!</h1>
          <p className="mt-1 text-white/90">{outletName(active.outletId)}</p>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Menu Anda</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {r.menu
            .filter((m) => m.href !== "/dashboard")
            .map((m) => (
              <Link key={m.href} href={m.href} className="rounded-2xl border border-matur-200 bg-white p-4 shadow-sm hover:shadow-md">
                <p className="font-semibold">{m.label}</p>
                <p className="text-xs text-stone-500">{m.stage === 1 ? "Tersedia" : `Tahap ${m.stage}`}</p>
              </Link>
            ))}
          {(active.role === "owner" || active.role === "admin_pusat") && (
            <Link href="/komponen" className="rounded-2xl border border-dashed border-matur-400 bg-matur-50 p-4">
              <p className="font-semibold">Coba konfirmasi edit & hapus 2 tahap</p>
              <p className="text-xs text-stone-500">Komponen standar Tahap 1</p>
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
