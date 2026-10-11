import Image from "next/image";
import Link from "next/link";
import { ProyekCard } from "@/components/proyek-card";
import { daftarProyek } from "@/lib/proyek";
import { CURRENT_STAGE, ROLES, findMenu } from "@/lib/roles";
import { getSession } from "@/lib/session";

export default async function Dashboard() {
  const s = (await getSession())!;
  const active = s.active!;
  const r = ROLES[active.role];
  const lihatProyek = findMenu(active.role, "/proyek") || findMenu(active.role, "/portal/pembangunan");
  const proyek = lihatProyek ? (await daftarProyek()).filter((p) => p.status === "berjalan") : [];

  return (
    <div className="space-y-6">
      <section className="flex items-center gap-5 overflow-hidden rounded-3xl bg-gradient-to-r from-matur-400 to-matur-600 p-6 text-white">
        <Image src={`/mascot/${r.mascot}.png`} alt="" width={120} height={120} priority className="hidden rounded-2xl sm:block" />
        <div>
          <p className="text-sm text-white/80">{r.label}</p>
          <h1 className="text-2xl font-bold sm:text-3xl">Sugeng rawuh, {s.nama}!</h1>
          <p className="mt-1 text-white/90">{active.outletNama}</p>
        </div>
      </section>

      {proyek.length > 0 && (
        <section>
          <h2 className="mb-3 font-semibold">Progres Pembangunan</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {proyek.map((p) => (
              <ProyekCard key={p.id} p={p} />
            ))}
          </div>
        </section>
      )}

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
