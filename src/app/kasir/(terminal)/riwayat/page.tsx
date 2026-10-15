import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { RiwayatView, type DraftRiwayat, type Trx } from "./riwayat-view";

// Transaksi hari ini di outlet ini; void dengan persetujuan PIN SPV.
export default async function Riwayat({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const tab = (await searchParams).tab === "draft" ? "draft" : "trx";
  const s = (await getSession())!;
  const supabase = await supabaseServer();
  const awal = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }).replace(/,.*/, "") + " 00:00:00 GMT+0700").toISOString();
  const seminggu = new Date(Date.now() - 7 * 86400_000).toISOString();
  const [{ data }, { data: drafts }] = await Promise.all([
    supabase
    .from("transaksi")
    .select("id, nomor, kanal, total, diskon, status, void_alasan, created_at, pelanggan, operator_nama, item_transaksi(nama, qty), pembayaran(metode, nominal)")
    .eq("mode", "asli")
    .eq("outlet_id", s.active!.outletId!)
    .gte("created_at", awal)
    .order("created_at", { ascending: false })
    .limit(300),
    supabase
      .from("pesanan_draft")
      .select("id, label, items, total, status, alasan_batal, nama_pembuat, nama_penutup, created_at, selesai_at, transaksi:transaksi!pesanan_draft_transaksi_id_fkey(nomor)")
      .eq("outlet_id", s.active!.outletId!)
      .or(`status.eq.draft,created_at.gte.${seminggu}`)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);
  return <RiwayatView trx={(data ?? []) as unknown as Trx[]} drafts={(drafts ?? []) as unknown as DraftRiwayat[]} outletNama={s.active!.outletNama} awal={tab} />;
}
