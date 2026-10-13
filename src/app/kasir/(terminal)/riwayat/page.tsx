import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { RiwayatView, type Trx } from "./riwayat-view";

// Transaksi hari ini di outlet ini; void dengan persetujuan PIN SPV.
export default async function Riwayat() {
  const s = (await getSession())!;
  const supabase = await supabaseServer();
  const awal = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }).replace(/,.*/, "") + " 00:00:00 GMT+0700").toISOString();
  const { data } = await supabase
    .from("transaksi")
    .select("id, nomor, kanal, total, diskon, status, void_alasan, created_at, pelanggan, item_transaksi(nama, qty), pembayaran(metode, nominal)")
    .eq("mode", "asli")
    .eq("outlet_id", s.active!.outletId!)
    .gte("created_at", awal)
    .order("created_at", { ascending: false })
    .limit(300);
  return <RiwayatView trx={(data ?? []) as unknown as Trx[]} />;
}
