import Link from "next/link";
import { RiwayatContent } from "../riwayat/content";
import { notFound } from "next/navigation";
import { POS_ROLES } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { Queue, type Order } from "./queue";

// POS-06: pesanan dari kasir tampil otomatis di layar barista
export default async function AntreanPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
  const sp=await searchParams;
  const history=sp.view==="riwayat";
  const s = await getSession();
  if (!s?.active?.outletId || !POS_ROLES.includes(s.active.role)) notFound();
  const supabase = await supabaseServer();
  const nav=<nav aria-label="Antrean dan riwayat order" className="mb-4 flex gap-2 rounded-2xl bg-matur-50 p-1 text-sm font-bold"><Link href="/kasir/antrean" className={`flex-1 rounded-xl p-3 text-center ${!history?'bg-kopi-900 text-white':'text-kopi-700'}`}>☕ Pesanan Aktif</Link><Link href="/kasir/antrean?view=riwayat" className={`flex-1 rounded-xl p-3 text-center ${history?'bg-kopi-900 text-white':'text-kopi-700'}`}>🧾 Riwayat Order</Link></nav>;
  if(history)return <>{nav}<RiwayatContent embedded searchParams={searchParams}/></>;
  const since = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
  const { data } = await supabase
    .from("transaksi")
    .select("id, nomor, kanal, tipe, pelanggan, meja, status_pesanan, created_at, item_transaksi(nama, qty, catatan)")
    .eq("outlet_id", s.active.outletId)
    .eq("status", "lunas")
    .eq("mode", "asli")
    .neq("status_pesanan", "diambil")
    .gte("created_at", since)
    .order("created_at");
  return <>{nav}<Queue orders={(data ?? []) as Order[]} /></>;
}
