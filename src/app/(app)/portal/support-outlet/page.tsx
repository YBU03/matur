import { notFound } from "next/navigation";
import { HeaderHalaman } from "@/components/ui-halaman";
import { SupportOutletCards } from "@/components/support-outlet-cards";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import type { KontakSupport } from "@/lib/support-outlet";

export default async function SupportOutletPage() {
  const s = await getSession();
  if (!s?.active || !["mitra", "owner", "admin_pusat"].includes(s.active.role))
    notFound();
  const db = await supabaseServer();
  const { data, error } = await db
    .from("support_outlet")
    .select("id,bagian,nama,nomor,aktif,urutan,updated_at")
    .eq("aktif", true)
    .is("deleted_at", null)
    .order("urutan")
    .order("bagian")
    .order("id");
  if (error)
    throw new Error(
      "Kontak Support Outlet belum dapat dimuat. Coba muat ulang.",
    );
  return (
    <div className="space-y-5">
      <HeaderHalaman
        judul="Support Outlet"
        ikon="☎️"
        keterangan="Butuh bantuan untuk outlet? Pilih bagian yang ingin dihubungi. Ketuk nomor untuk langsung membuka WhatsApp."
      />
      <SupportOutletCards rows={(data ?? []) as KontakSupport[]} />
    </div>
  );
}
