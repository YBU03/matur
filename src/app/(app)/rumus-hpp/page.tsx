import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { RumusView } from "./rumus-view";

// Rumus HPP yang bisa diatur Akunting: komponen mana yang ikut, dan kategori biaya mana yang dihitung sebagai pembelian bahan baku.
export default async function RumusHpp() {
  const s = await getSession();
  if (!s?.active || !["owner", "admin_pusat", "finance"].includes(s.active.role)) notFound();
  const supabase = await supabaseServer();
  const [{ data: pt }, { data: kat }] = await Promise.all([
    supabase.from("perusahaan").select("rumus_hpp").limit(1).maybeSingle(),
    supabase.from("kategori_biaya").select("id, nama, grup, urutan").order("urutan"),
  ]);
  const r = (pt?.rumus_hpp ?? {}) as { kiriman_gudang?: boolean; titipan?: boolean };
  return <RumusView rumus={{ kiriman_gudang: r.kiriman_gudang !== false, titipan: r.titipan !== false }} kategori={(kat ?? []) as { id: string; nama: string; grup: string; urutan: number }[]} />;
}
