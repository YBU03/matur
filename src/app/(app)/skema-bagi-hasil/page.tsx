import { notFound } from "next/navigation";
import type { Rincian } from "@/lib/skema-actions";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { SkemaAdmin, type Skema } from "./skema-admin";

export default async function SkemaBagiHasil() {
  const s = await getSession();
  if (!s?.active || !["owner", "admin_pusat", "finance"].includes(s.active.role)) notFound();
  const supabase = await supabaseServer();
  const [{ data: sk }, { data: os }] = await Promise.all([
    supabase.from("skema_bagi_hasil").select("id, nama, keterangan, persen_sedekah, rincian").is("deleted_at", null).order("created_at"),
    supabase.from("outlet").select("id, nama, skema_bagi_hasil_id").eq("mode", "asli").is("deleted_at", null).order("tgl_mulai"),
  ]);
  const skema = (sk ?? []).map((x) => ({ ...x, persen_sedekah: Number(x.persen_sedekah), rincian: x.rincian as Rincian[] })) as Skema[];
  return <SkemaAdmin skema={skema} outlets={os ?? []} />;
}
