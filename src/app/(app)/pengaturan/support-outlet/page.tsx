import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import type { KontakSupport } from "@/lib/support-outlet";
import { SupportEditor } from "./support-editor";

export default async function KelolaSupportOutlet() {
  const s = await getSession();
  if (!s?.active || !["owner", "admin_pusat"].includes(s.active.role))
    notFound();
  const db = await supabaseServer();
  const { data, error } = await db
    .from("support_outlet")
    .select("id,bagian,nama,nomor,aktif,urutan,updated_at")
    .is("deleted_at", null)
    .order("urutan")
    .order("bagian")
    .order("id");
  if (error)
    throw new Error("Daftar kontak belum dapat dimuat. Coba muat ulang.");
  return <SupportEditor rows={(data ?? []) as KontakSupport[]} />;
}
