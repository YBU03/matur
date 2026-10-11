import { notFound } from "next/navigation";
import { findMenu } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { Queue, type Order } from "./queue";

// POS-06: pesanan dari kasir tampil otomatis di layar barista
export default async function AntreanPage() {
  const s = await getSession();
  if (!s?.active?.outletId || !findMenu(s.active.role, "/antrean")) notFound();
  const supabase = await supabaseServer();
  const since = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
  const { data } = await supabase
    .from("transaksi")
    .select("id, nomor, kanal, tipe, pelanggan, meja, status_pesanan, created_at, item_transaksi(nama, qty, catatan)")
    .eq("outlet_id", s.active.outletId)
    .eq("status", "lunas")
    .neq("status_pesanan", "diambil")
    .gte("created_at", since)
    .order("created_at");
  return <Queue orders={(data ?? []) as Order[]} />;
}
