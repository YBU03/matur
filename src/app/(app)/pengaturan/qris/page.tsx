import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { QrisView, type OutletQris } from "./qris-view";

// QRIS per outlet: diunggah Owner / Admin Pusat / Admin Gudang, tampil di layar kasir saat bayar QRIS.
export default async function PengaturanQris() {
  const s = await getSession();
  if (!s?.active || !["owner", "admin_pusat", "admin_gudang"].includes(s.active.role)) notFound();
  const supabase = await supabaseServer();
  const { data } = await supabase.from("outlet").select("id, nama, qris_url, qris_payload, qris_nama, qris_dinamis").eq("mode", "asli").is("deleted_at", null).order("tgl_mulai");
  return <QrisView outlets={(data ?? []) as OutletQris[]} />;
}
