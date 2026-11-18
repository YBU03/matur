import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { tglOperasional, awalOperasional } from "@/lib/hari-operasional";
import { KoreksiPenjualan } from "./panel";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ outlet?: string; dari?: string; sampai?: string }>;
}) {
  const session = await getSession();
  if (
    !["owner", "admin_pusat", "finance"].includes(session?.active?.role ?? "")
  )
    notFound();
  const sp = await searchParams,
    db = await supabaseServer();
  const os = await db
    .from("outlet")
    .select("id,nama")
    .eq("mode", "asli")
    .is("deleted_at", null)
    .order("nama");
  const outlet =
    os.data?.find((o) => o.id === sp.outlet)?.id ?? os.data?.[0]?.id ?? "";
  const valid = (x?: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(x ?? "") && Number.isFinite(Date.parse(x!));
  const dari = valid(sp.dari) ? sp.dari! : tglOperasional(),
    sampai = valid(sp.sampai) ? sp.sampai! : dari;
  const next = new Date(sampai + "T12:00:00Z");
  next.setUTCDate(next.getUTCDate() + 1);
  const [sales, menus, shifts] = await Promise.all([
    db
      .from("transaksi")
      .select(
        "id,nomor,created_at,total,diskon,kanal,status,sesi_kas_id,koreksi_penjualan",
      )
      .eq("mode", "asli")
      .eq("outlet_id", outlet)
      .gte("created_at", awalOperasional(dari))
      .lt("created_at", awalOperasional(next.toISOString().slice(0, 10)))
      .order("created_at", { ascending: false })
      .limit(1000),
    db
      .from("menu")
      .select("id,nama,harga_langsung,harga_ojol")
      .eq("mode", "asli")
      .eq("aktif", true)
      .is("deleted_at", null)
      .order("nama"),
    db
      .from("sesi_kas")
      .select("id,tanggal_shift,nama_kasir,setoran,seharusnya,selisih")
      .eq("mode", "asli")
      .eq("outlet_id", outlet)
      .gte("tanggal_shift", dari)
      .lte("tanggal_shift", sampai)
      .not("ditutup_at", "is", null)
      .order("tanggal_shift", { ascending: false }),
  ]);
  return (
    <KoreksiPenjualan
      key={`${outlet}-${dari}-${sampai}`}
      outlets={os.data ?? []}
      outlet={outlet}
      dari={dari}
      sampai={sampai}
      sales={sales.data ?? []}
      menus={menus.data ?? []}
      shifts={shifts.data ?? []}
      error={
        os.error?.message ||
        sales.error?.message ||
        menus.error?.message ||
        shifts.error?.message
      }
    />
  );
}
