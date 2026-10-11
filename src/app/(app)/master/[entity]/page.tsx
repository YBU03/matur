import { notFound } from "next/navigation";
import { ENTITIES } from "@/lib/master";
import { findMenu } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { MasterTable } from "./master-table";

export default async function MasterPage({
  params,
  searchParams,
}: {
  params: Promise<{ entity: string }>;
  searchParams: Promise<{ sampah?: string }>;
}) {
  const { entity: key } = await params;
  const trash = (await searchParams).sampah === "1";
  const entity = ENTITIES[key];
  const s = await getSession();
  if (!entity || !s?.active || !findMenu(s.active.role, `/master/${key}`)) notFound();

  const supabase = await supabaseServer();
  let q = supabase.from(entity.table).select("*").limit(500);
  q = trash ? q.not("deleted_at", "is", null).order("deleted_at", { ascending: false }) : q.is("deleted_at", null);
  const { data: rows } = await q;

  // opsi untuk kolom rujukan (select)
  const refs: Record<string, { id: string; label: string }[]> = {};
  await Promise.all(
    entity.fields
      .filter((f) => f.ref)
      .map(async (f) => {
        let rq = supabase.from(f.ref!.table).select(`id, ${f.ref!.label}`).order(f.ref!.label).limit(500);
        if (f.ref!.table !== "pengguna") rq = rq.is("deleted_at", null);
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
      canEdit={entity.editors.includes(s.active.role)}
    />
  );
}
