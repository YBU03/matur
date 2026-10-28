import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { OpnameView } from "@/app/(app)/stok/opname-view";

// Stok & opname outlet: hitung fisik akhir bulan → nilai persediaan akhir laporan
export async function OpnameOutlet({
  searchParams,
}: {
  searchParams: Promise<{ outlet?: string }>;
}) {
  const s = await getSession();
  if (
    !s?.active ||
    ![
      "owner",
      "admin_pusat",
      "admin_gudang",
      "hrd",
      "finance",
      "spv",
      "kasir",
      "barista",
      "tablet",
    ].includes(s.active.role)
  )
    notFound();
  const personal = ["spv", "kasir", "barista", "tablet"].includes(
    s.active.role,
  );
  const sembunyikanNilai = ["kasir", "barista", "tablet"].includes(s.active.role);
  if (personal && !s.active.outletId) notFound();
  const supabase = await supabaseServer();
  const { data: outlets, error: outletError } = await supabase
    .from("outlet")
    .select("id, nama")
    .eq("mode", "asli")
    .is("deleted_at", null)
    .order("tgl_mulai");
  if (outletError)
    throw new Error("Outlet belum dapat dimuat: " + outletError.message);
  const daftar = outlets ?? [];
  const sp = await searchParams;
  const outlet = personal
    ? daftar.find((o) => o.id === s.active!.outletId)
    : (daftar.find((o) => o.id === sp.outlet) ?? daftar[0]);
  if (!outlet) notFound();
  const [bahanResult, stokResult, riwayatResult] = await Promise.all([
    supabase
      .from("bahan")
      .select(
        "id, nama, kategori, satuan_beli, satuan_pakai, konversi, harga_jual_gudang, harga_beli",
      )
      .eq("mode", "asli")
      .is("deleted_at", null)
      .order("urutan")
      .order("nama"),
    supabase
      .from("stok")
      .select("bahan_id, jumlah")
      .eq("mode", "asli")
      .eq("outlet_id", outlet.id),
    supabase
      .from("opname")
      .select(
        "id, tanggal, total_nilai, catatan, created_at, petugas_nama, item_opname(bahan_id, qty_sistem, qty_fisik)",
      )
      .eq("mode", "asli")
      .eq("outlet_id", outlet.id)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);
  const failed = [bahanResult, stokResult, riwayatResult].find((r) => r.error);
  if (failed?.error)
    throw new Error("Data SO belum bisa dimuat: " + failed.error.message);
  const bahan = bahanResult.data,
    stok = stokResult.data,
    riwayat = riwayatResult.data;
  const m = new Map((stok ?? []).map((x) => [x.bahan_id, Number(x.jumlah)]));
  return (
    <OpnameView
      key={outlet.id}
      outlets={personal ? [outlet] : daftar}
      tampilNilai={!sembunyikanNilai}
      outletId={outlet.id}
      bahan={(bahan ?? []).map((b) => {
        const konversi = Number(b.konversi) || 1;
        return {
          id: b.id,
          nama: b.nama,
          kategori: b.kategori,
          satuan_beli: b.satuan_beli,
          satuan_pakai: b.satuan_pakai,
          konversi,
          hargaPakai: sembunyikanNilai
            ? 0
            : Number(b.harga_jual_gudang || b.harga_beli || 0) / konversi,
          sistem: m.get(b.id) ?? 0,
        };
      })}
      riwayat={(riwayat ?? []).map((r) => ({
        ...r,
        total_nilai: sembunyikanNilai ? 0 : r.total_nilai,
      }))}
    />
  );
}
