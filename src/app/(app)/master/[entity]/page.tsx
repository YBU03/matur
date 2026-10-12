import { notFound } from "next/navigation";
import { ENTITIES } from "@/lib/master";
import { findMenu } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { MasterTable } from "./master-table";

// tabel tanpa kolom mode (asli/simulasi)
const NO_MODE = new Set(["pengguna", "mitra", "jadwal_proyek", "setoran_mitra", "checklist_proyek", "usulan_tanggal"]);

export default async function MasterPage({
  params,
  searchParams,
}: {
  params: Promise<{ entity: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { entity: key } = await params;
  const sp = await searchParams;
  const trash = sp.sampah === "1";
  const entity = ENTITIES[key];
  const s = await getSession();
  if (!entity || !s?.active || !(findMenu(s.active.role, `/master/${key}`) || entity.editors.includes(s.active.role))) notFound();
  // filter dari query, mis. /master/pekerjaan?proyek_id=… (juga jadi nilai awal saat tambah)
  const filter = Object.fromEntries(entity.fields.filter((f) => f.type === "select" && sp[f.key]).map((f) => [f.key, sp[f.key]!]));

  const supabase = await supabaseServer();
  let q = supabase.from(entity.table).select("*").limit(500);
  if (!NO_MODE.has(entity.table)) q = q.eq("mode", "asli"); // data simulasi tidak tampil di data master
  q = trash ? q.not("deleted_at", "is", null).order("deleted_at", { ascending: false }) : q.is("deleted_at", null);
  for (const [k, v] of Object.entries(filter)) q = q.eq(k, v);
  const { data: rows } = await q;

  // opsi untuk kolom rujukan (select)
  const refs: Record<string, { id: string; label: string }[]> = {};
  await Promise.all(
    entity.fields
      .filter((f) => f.ref)
      .map(async (f) => {
        let rq = supabase.from(f.ref!.table).select(`id, ${f.ref!.label}`).order(f.ref!.label).limit(500);
        if (f.ref!.table !== "pengguna") rq = rq.is("deleted_at", null);
        if (!NO_MODE.has(f.ref!.table)) rq = rq.eq("mode", "asli");
        const { data } = await rq;
        refs[f.key] = ((data ?? []) as unknown as Record<string, string>[]).map((r) => ({ id: r.id, label: r[f.ref!.label] }));
      }),
  );

  return (
    <MasterTable
      entityKey={key}
      entity={entity}
      rows={(rows ?? []) as Record<string, unknown>[]}
      refs={refs}
      trash={trash}
      filter={filter}
      canEdit={entity.editors.includes(s.active.role)}
    />
  );
}
