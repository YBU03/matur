import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { PENGELOLA_MENU, type GrupOpsi } from "@/lib/menu-varian";
import { VarianMenuView } from "./view";
import type { BahanHpp } from "@/lib/hpp-live";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s?.active || !PENGELOLA_MENU.includes(s.active.role)) notFound();
  const { id } = await params;
  const db = await supabaseServer();
  const { data: m } = await db
    .from("menu")
    .select("id,nama,harga_langsung,harga_ojol,foto_url,induk_id,kategori_menu(nama)")
    .eq("id", id)
    .eq("mode", "asli")
    .is("deleted_at", null)
    .maybeSingle();
  if (!m || m.induk_id) notFound();
  const [{ data: anak }, { data: opsi }, { data: bahan }] = await Promise.all([
    db.from("menu").select("id,kemasan,harga_langsung,harga_ojol,aktif").eq("induk_id", id).is("deleted_at", null).order("harga_langsung"),
    db.from("varian").select("grup,nama,tambahan_harga").eq("menu_id", id).eq("mode", "asli").is("deleted_at", null).order("tambahan_harga").order("nama"),
    db.from("bahan").select("id,nama,satuan_pakai,harga_pokok").eq("mode", "asli").is("deleted_at", null).order("nama"),
  ]);
  const { data: resep } = await db
    .from("resep")
    .select("menu_id,varian_id,bahan_id,takaran")
    .eq("mode", "asli")
    .is("deleted_at", null)
    .in("menu_id", [id, ...(anak ?? []).map((k) => k.id)]);
  return (
    <VarianMenuView
      key={JSON.stringify([anak, opsi])}
      menu={{
        id: m.id,
        nama: m.nama,
        harga_langsung: Number(m.harga_langsung),
        harga_ojol: Number(m.harga_ojol),
        foto_url: m.foto_url,
        kategori: (m.kategori_menu as unknown as { nama: string } | null)?.nama ?? null,
      }}
      kemasan={(anak ?? []).map((k) => ({ id: k.id, nama: k.kemasan ?? "", harga_langsung: Number(k.harga_langsung), harga_ojol: Number(k.harga_ojol), aktif: k.aktif }))}
      bahan={(bahan ?? []) as BahanHpp[]}
      resep={(resep ?? []).filter((r) => !r.varian_id).map((r) => ({ menu_id: r.menu_id, bahan_id: r.bahan_id, takaran: Number(r.takaran) }))}
      opsi={(opsi ?? []).filter((o) => ["Gula", "Extra", "Suhu", "Ukuran"].includes(o.grup)).map((o) => ({ grup: o.grup as GrupOpsi, nama: o.nama, tambahan_harga: Number(o.tambahan_harga) }))}
    />
  );
}
