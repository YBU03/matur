import { notFound } from "next/navigation";
import Link from "next/link";
import type { Manual } from "@/lib/harian";
import type { SusunanTabel } from "@/lib/harian-actions";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import {
  CatatanHarian,
  type Biaya,
  type Hari,
  type ProdukKeluar,
  type Sesi,
} from "./catatan-view";

const BOLEH = ["owner", "admin_pusat", "finance", "spv"];

// Catatan harian outlet (pengganti sheet "Transaksi" Ruma): penjualan per kanal dari POS + koreksi/angka platform,
// pengeluaran, produk marketing, shift & setoran kas — per tanggal.
export default async function CatatanHarianPage({
  searchParams,
}: {
  searchParams: Promise<{
    outlet?: string;
    bulan?: string;
    sim?: string;
    q?: string;
  }>;
}) {
  const s = await getSession();
  if (!s?.active || !BOLEH.includes(s.active.role)) notFound();
  const sp = await searchParams;
  const supabase = await supabaseServer();
  const { data: outlets } = await supabase
    .from("outlet")
    .select("id, nama")
    .eq("mode", "asli")
    .is("deleted_at", null)
    .order("tgl_mulai");
  const daftar = outlets ?? [];
  const outlet =
    (s.active.role === "spv"
      ? daftar.find((o) => o.id === s.active!.outletId)
      : daftar.find((o) => o.id === sp.outlet)) ?? daftar[0];
  if (!outlet) notFound();
  const bulan = /^\d{4}-\d{2}$/.test(sp.bulan ?? "")
    ? sp.bulan!
    : new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 7);
  const awal = `${bulan}-01`;
  const akhir = new Date(
    new Date(awal + "T00:00:00Z").setUTCMonth(
      new Date(awal + "T00:00:00Z").getUTCMonth() + 1,
    ),
  )
    .toISOString()
    .slice(0, 10);
  const sim = sp.sim === "1" && s.active.role === "owner";
  const mode = sim ? "simulasi" : "asli";
  const ta = new Date(awal + "T00:00:00+07:00").toISOString();
  const tb = new Date(akhir + "T00:00:00+07:00").toISOString();
  const [
    { data: hari },
    { data: biaya },
    { data: kat },
    { data: manual },
    { data: produk },
    { data: sesiData, error: sesiError },
    { data: menu },
  ] = await Promise.all([
    supabase.rpc("rekap_harian", {
      p_outlet: outlet.id,
      p_periode: awal,
      p_mode: mode,
    }),
    supabase
      .from("biaya_outlet")
      .select(
        "id, tanggal, kategori_id, jumlah, keterangan, sumber, sesi_kas_id, created_at, pengguna:pengguna!biaya_outlet_dibuat_oleh_fkey(nama)",
      )
      .eq("mode", mode)
      .eq("outlet_id", outlet.id)
      .gte("tanggal", awal)
      .lt("tanggal", akhir)
      .is("deleted_at", null)
      .order("created_at"),
    supabase
      .from("kategori_biaya")
      .select("id, nama, grup, urutan")
      .order("urutan"),
    supabase
      .from("penjualan_manual")
      .select(
        "id, tanggal, kanal, jenis, jumlah, keterangan, nama_pembuat, created_at",
      )
      .eq("mode", mode)
      .eq("outlet_id", outlet.id)
      .gte("tanggal", awal)
      .lt("tanggal", akhir)
      .is("deleted_at", null)
      .order("created_at"),
    supabase
      .from("produk_keluar")
      .select(
        "id, tanggal, jenis, penerima, items, total_hpp, nilai_jual, catatan, nama_pembuat, created_at",
      )
      .eq("mode", mode)
      .eq("outlet_id", outlet.id)
      .gte("tanggal", awal)
      .lt("tanggal", akhir)
      .is("deleted_at", null)
      .order("created_at"),
    supabase.rpc("sesi_catatan_harian", { o: outlet.id, d: awal, a: akhir, md: mode }),
    supabase
      .from("menu")
      .select("id, nama")
      .eq("mode", "asli")
      .is("deleted_at", null)
      .order("nama"),
  ]);
  if (sesiError) throw new Error(sesiError.message);
  const sesi = (sesiData ?? []) as Sesi[];
  const { data: revisi, error: revisiError } = await supabase
    .from("revisi_aktual_kas")
    .select("*")
    .in(
      "sesi_id",
      (sesi ?? []).map((x) => x.id),
    )
    .order("created_at", { ascending: false });
  const { data: belanja, error: belanjaError } = await supabase
    .from("belanja_bahan_outlet")
    .select("*")
    .eq("outlet_id", outlet.id)
    .gte("created_at", ta)
    .lt("created_at", tb)
    .order("created_at", { ascending: false });
  if (
    belanjaError ||
    (["owner", "admin_pusat", "finance"].includes(s.active.role) && revisiError)
  )
    throw new Error((belanjaError ?? revisiError)!.message);
  const { data: pt } = await supabase.from("perusahaan").select("tabel_harian").limit(1).maybeSingle();
  const { data: arsipExcel, error: arsipError } = !sim && ["owner", "admin_pusat", "finance"].includes(s.active.role)
    ? await supabase.from("laporan_internal").select("versi_excel:snapshot->sumber_excel->versi").eq("outlet_id", outlet.id).eq("periode", `${bulan}-01`).maybeSingle()
    : { data: null, error: null };
  if (arsipError) throw new Error("Gagal membaca arsip Excel laporan.");
  return (
    <>
    {Number(arsipExcel?.versi_excel) === 1 && <p className="mb-4 rounded-xl border border-matur-200 bg-matur-50 p-3 text-sm">Data diimpor dari Excel. Rincian shift, kas aktual, selisih, nilai presisi, dan seluruh sel sumber tersedia di <Link className="font-bold underline" href={`/laporan/internal?outlet=${outlet.id}&bulan=${bulan}`}>Lihat sumber Excel & PDF lengkap</Link>.</p>}
    <CatatanHarian
      susunan={(pt?.tabel_harian ?? {}) as Partial<SusunanTabel>}
      key={`${outlet.id}-${bulan}-${sim}`}
      outlets={s.active.role === "spv" ? [outlet] : daftar}
      outletId={outlet.id}
      bulan={bulan}
      sim={sim}
      bolehSim={s.active.role === "owner"}
      cariAwal={sp.q ?? ""}
      hari={(hari ?? []) as Hari[]}
      biaya={(biaya ?? []) as unknown as Biaya[]}
      kategori={
        (kat ?? []) as {
          id: string;
          nama: string;
          grup: string;
          urutan: number;
        }[]
      }
      manual={(manual ?? []) as Manual[]}
      produk={(produk ?? []) as ProdukKeluar[]}
      sesi={sesi}
      menu={menu ?? []}
      revisi={revisi ?? []}
      belanja={sim ? [] : (belanja ?? [])}
      bolehImpor={["owner", "admin_pusat", "finance"].includes(s.active.role)}
    />
    </>
  );
}
