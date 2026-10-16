import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { SimulasiPos } from "./view";
import type { SimMenu } from "@/lib/pos-simulasi";
export default async function Page() {
  const s = await getSession();
  if (
    !s?.active ||
    !["owner", "hrd", "admin_pusat", "admin_gudang"].includes(s.active.role)
  )
    notFound();
  const db = await supabaseServer();
  const { data, error } = await db
    .from("menu")
    .select(
      "id,nama,harga_langsung,harga_ojol,varian(id,nama,tambahan_harga,deleted_at)",
    )
    .eq("mode", "asli")
    .eq("aktif", true)
    .is("deleted_at", null)
    .order("nama");
  if (error) throw new Error("Menu simulasi gagal dimuat.");
  const menu = (data ?? []).map((m) => ({
    ...m,
    varian: m.varian.filter((v) => !v.deleted_at),
  })) as SimMenu[];
  return (
    <div className="space-y-4">
      <Link href="/pengaturan/pos" className="text-sm underline">
        ← Pengaturan perangkat POS
      </Link>
      <h1 className="text-2xl font-bold">Simulasi POS</h1>
      <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold">
        SIMULASI · Tidak membuat transaksi, shift, setoran, atau perubahan stok
        asli. Tidak memerlukan perpindahan perangkat. QRIS/bukti pembayaran
        sungguhan tidak digunakan.
      </p>
      <SimulasiPos menu={menu} />
    </div>
  );
}
