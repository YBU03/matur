import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { kopGudang } from "@/lib/gudang-dokumen-data";
import type { Kiriman, ItemKiriman } from "@/lib/kiriman";
import { EditorDokumen } from "./view";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ jenis?: string }>;
}) {
  const s = await getSession();
  if (
    !s?.active ||
    !["owner", "admin_pusat", "admin_gudang"].includes(s.active.role)
  )
    notFound();
  const { id } = await params,
    sp = await searchParams,
    jenis = sp.jenis === "surat-jalan" ? "surat-jalan" : "invoice",
    db = await supabaseServer();
  const [
    { data: k, error },
    { data: items, error: ei },
    { data: outlets, error: eo },
    { data: pt },
    { data: revisi },
  ] = await Promise.all([
    db
      .from("kiriman")
      .select(
        "*,outlet(nama,alamat,telepon),dokumen:dokumen_kiriman_gudang(jenis,isi,terbit,versi,arsip_at,terbit_at),penyesuaian:invoice_penyesuaian_gudang(nilai,keterangan,versi)",
      )
      .eq("id", id)
      .eq("mode", "asli")
      .is("deleted_at", null)
      .maybeSingle(),
    db
      .from("item_kiriman")
      .select("id,bahan_id,nama,satuan,konversi,qty,harga,qty_diterima")
      .eq("kiriman_id", id)
      .order("nama"),
    db
      .from("outlet")
      .select("id,nama,alamat,telepon")
      .eq("mode", "asli")
      .is("deleted_at", null)
      .order("nama"),
    db
      .from("perusahaan")
      .select("nama,alamat,email,telepon")
      .limit(1)
      .maybeSingle(),
    db
      .from("dokumen_kiriman_revisi")
      .select("versi,aksi,waktu")
      .eq("kiriman_id", id)
      .eq("jenis", jenis)
      .order("versi", { ascending: false })
      .limit(20),
  ]);
  if (error || ei || eo) throw new Error("Data editor belum dapat dimuat.");
  if (!k) notFound();
  const kop = await kopGudang(
    db,
    pt ?? {
      nama: "CV. Hazna Berkah Indonesia",
      alamat: null,
      email: null,
      telepon: null,
    },
  );
  return (
    <EditorDokumen
      key={id + jenis}
      jenis={jenis}
      k={k as unknown as Kiriman}
      items={(items ?? []) as ItemKiriman[]}
      outlets={outlets ?? []}
      pt={kop}
      revisi={revisi ?? []}
    />
  );
}
