import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import type { RabRow } from "@/lib/rab-excel";
import { RabView } from "./rab-view";

export default async function RincianKeperluan({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getSession();
  if (!s?.active) notFound();
  const supabase = await supabaseServer();
  const { data: p } = await supabase.from("proyek").select("id, nama, estimasi_budget, outlet(nama)").eq("id", id).is("deleted_at", null).maybeSingle();
  if (!p) notFound(); // RLS: hanya proyek yang boleh dilihat
  const { data } = await supabase
    .from("item_rab")
    .select("id, kategori, bagian, nama, spesifikasi, qty, satuan, harga_satuan, harga_estimasi, harga_realisasi, status, keterangan")
    .eq("proyek_id", id)
    .is("deleted_at", null)
    .order("urutan")
    .order("nama");
  const items = (data ?? []).map((r) => ({ ...r, qty: Number(r.qty) })) as (RabRow & { id: string })[];
  return (
    <RabView
      proyek={{ id: p.id, nama: p.nama, budget: p.estimasi_budget, outlet: (p.outlet as unknown as { nama: string } | null)?.nama ?? "" }}
      items={items}
      admin={s.active.role === "owner" || s.active.role === "admin_pusat"}
    />
  );
}
