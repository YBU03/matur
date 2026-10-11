import Link from "next/link";
import { notFound } from "next/navigation";
import { ProyekCard } from "@/components/proyek-card";
import { daftarProyek } from "@/lib/proyek";
import { findMenu } from "@/lib/roles";
import { getSession } from "@/lib/session";

export default async function ProyekPage() {
  const s = await getSession();
  if (!s?.active || !(findMenu(s.active.role, "/proyek") || findMenu(s.active.role, "/portal/pembangunan"))) notFound();
  const admin = s.active.role === "owner" || s.active.role === "admin_pusat";
  const list = await daftarProyek();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-2xl font-bold">Proyek Pembangunan</h1>
        {admin && (
          <Link href="/master/proyek" className="rounded-xl bg-matur-500 px-4 py-2 text-sm font-semibold text-white">
            + Kelola Proyek
          </Link>
        )}
      </div>
      {list.length === 0 && <p className="py-10 text-center text-stone-400">Belum ada proyek pembangunan.</p>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {list.map((p) => (
          <ProyekCard key={p.id} p={p} />
        ))}
      </div>
    </div>
  );
}
