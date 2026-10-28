import { kopGudang } from "@/lib/gudang-dokumen-data";
import { notFound, redirect } from "next/navigation";
import type { ItemKiriman, Kiriman } from "@/lib/kiriman";
import { findMenu } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { KirimanView } from "./kiriman-view";

export default async function DetailKiriman({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const s = await getSession();
  if (!s?.active || !findMenu(s.active.role, "/gudang/kiriman")) notFound();
  const gudang = ["owner", "admin_pusat", "admin_gudang"].includes(
    s.active.role,
  );
  const supabase = await supabaseServer();
  const [{ data: k }, { data: items }, { data: pt }] = await Promise.all([
    supabase
      .from("kiriman")
      .select(
        "id, outlet_id, nomor, tanggal, status, pemeriksaan_status, pembuat_nama, pemeriksa_nama, catatan, pengirim, total, dikirim_at, diterima_at, nama_penerima, outlet(nama, alamat, telepon), dokumen:dokumen_kiriman_gudang(jenis,isi,terbit,versi,arsip_at,terbit_at),penyesuaian:invoice_penyesuaian_gudang(nilai,keterangan,versi),pembuat:pengguna!kiriman_dibuat_oleh_fkey(nama)",
      )
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("item_kiriman")
      .select("id, bahan_id, nama, satuan, konversi, qty, harga, qty_diterima")
      .eq("kiriman_id", id)
      .order("nama"),
    supabase
      .from("perusahaan")
      .select("nama, alamat, email, telepon")
      .limit(1)
      .maybeSingle(),
  ]);
  if (!k) notFound();
  k.pembuat_nama ??=
    (k.pembuat as unknown as { nama: string } | null)?.nama ?? null; // RLS: outlet hanya melihat kirimannya sendiri
  if (k.status === "dikirim" || k.status === "diterima")
    redirect(`/operasional/kiriman?outlet=${k.outlet_id}&id=${k.id}`);
  let bahan: {
    id: string;
    nama: string;
    satuan_beli: string;
    harga: number;
    stok: number;
  }[] = [];
  if (gudang && k.status === "draft") {
    const [{ data: b }, { data: st }] = await Promise.all([
      supabase
        .from("bahan")
        .select(
          "id, nama, satuan_beli, konversi, harga_jual_gudang, harga_beli",
        )
        .eq("mode", "asli")
        .is("deleted_at", null)
        .order("urutan")
        .order("nama"),
      supabase
        .from("stok")
        .select("bahan_id, jumlah")
        .eq("mode", "asli")
        .is("outlet_id", null),
    ]);
    const m = new Map((st ?? []).map((x) => [x.bahan_id, Number(x.jumlah)]));
    bahan = (b ?? []).map((x) => ({
      id: x.id,
      nama: x.nama,
      satuan_beli: x.satuan_beli,
      harga: Number(x.harga_jual_gudang ?? x.harga_beli ?? 0),
      stok: (m.get(x.id) ?? 0) / (Number(x.konversi) || 1),
    }));
  }
  const terimaBoleh =
    k.status === "dikirim" &&
    (gudang || ["spv", "kasir", "barista"].includes(s.active.role));
  return (
    <KirimanView
      k={k as unknown as Kiriman}
      items={
        (items ?? []).map((i) => ({
          ...i,
          qty: Number(i.qty),
          konversi: Number(i.konversi),
          qty_diterima: i.qty_diterima === null ? null : Number(i.qty_diterima),
        })) as ItemKiriman[]
      }
      bahan={bahan}
      gudang={gudang}
      terimaBoleh={terimaBoleh}
      pt={await kopGudang(
        supabase,
        pt ?? {
          nama: "CV. Hazna Berkah Indonesia",
          alamat: null,
          email: null,
          telepon: null,
        },
      )}
      namaSaya={s.nama}
    />
  );
}
