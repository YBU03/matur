import Image from "next/image";
import { redirect } from "next/navigation";
import { ROLES } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { ProfilForm } from "./profil-form";

export default async function Profil() {
  const s = await getSession();
  if (!s?.active) redirect("/login");
  const supabase = await supabaseServer();
  const { data: p } = await supabase.from("pengguna").select("nama, email, no_hp").eq("id", s.userId).single();
  const r = ROLES[s.active.role];
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <section className="flex items-center gap-4 rounded-3xl bg-gradient-to-r from-matur-400 to-matur-600 p-5 text-white">
        <Image src={`/mascot/${r.mascot}.png`} alt="" width={72} height={72} className="rounded-2xl bg-white/20" />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold">{p?.nama ?? s.nama}</h1>
          <p className="truncate text-sm text-white/90">{p?.email}</p>
        </div>
      </section>
      <section className="rounded-2xl border border-matur-200 bg-white p-4">
        <h2 className="mb-2 font-bold">Peran saya</h2>
        <ul className="divide-y text-sm">
          {s.assignments.map((a) => (
            <li key={`${a.role}-${a.outletId}`} className="flex items-center gap-2 py-2">
              <span className="size-2 rounded-full bg-matur-400" />
              <span className="flex-1">
                <b className="font-medium">{ROLES[a.role].label}</b> · <span className="text-stone-500">{a.outletNama}</span>
              </span>
              {a.role === s.active!.role && a.outletId === s.active!.outletId && <span className="text-xs text-green-700">aktif</span>}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-stone-400">Peran dan outlet diatur oleh Owner/Admin.</p>
      </section>
      <ProfilForm nama={p?.nama ?? ""} hp={p?.no_hp ?? ""} pakaiPassword={!p?.email?.endsWith("@pin.matur.id")} />
    </div>
  );
}
