import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { STRUK_BAWAAN, type StrukOutlet } from "@/lib/struk";
import { StrukView } from "./struk-view";

// Isi struk POS per outlet (kepala, alamat, telepon, instagram, wifi, tagline). Owner / Admin Pusat / Admin Gudang.
export default async function PengaturanStruk() {
  const s = await getSession();
  if (!s?.active || !["owner", "admin_pusat", "admin_gudang"].includes(s.active.role)) notFound();
  const supabase = await supabaseServer();
  const [{ data: outlets }, { data: struk }] = await Promise.all([
    supabase.from("outlet").select("id, nama").eq("mode", "asli").is("deleted_at", null).order("tgl_mulai"),
    supabase.from("struk_outlet").select("outlet_id, judul, alamat, telepon, instagram, wifi, tagline, hashtag, catatan, tampil_logo, updated_at"),
  ]);
  const peta = new Map((struk ?? []).map((x) => [x.outlet_id as string, x]));
  return (
    <StrukView
      outlets={(outlets ?? []).map((o) => {
        const x = peta.get(o.id);
        const isi: StrukOutlet = x
          ? { judul: x.judul, alamat: x.alamat, telepon: x.telepon, instagram: x.instagram, wifi: x.wifi, tagline: x.tagline, hashtag: x.hashtag, catatan: x.catatan, tampil_logo: x.tampil_logo }
          : STRUK_BAWAAN;
        return { id: o.id, nama: o.nama, struk: isi, diubah: (x?.updated_at as string | undefined) ?? null };
      })}
    />
  );
}
