import { notFound } from "next/navigation";
import { LAPORAN_COLS, type Laporan, type Proyeksi } from "@/lib/laporan";
import type { Rincian } from "@/lib/skema-actions";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { ProyeksiForm } from "./proyeksi-form";

// Proyeksi laporan bulanan otomatis dari POS (penjualan), gudang (kiriman diterima) dan biaya operasional harian
export default async function ProyeksiLaporan({ searchParams }: { searchParams: Promise<{ outlet?: string; bulan?: string; sim?: string }> }) {
  const s = await getSession();
  if (!s?.active || !["owner", "admin_pusat", "finance"].includes(s.active.role)) notFound();
  const sp = await searchParams;
  const supabase = await supabaseServer();
  const { data: outlets } = await supabase.from("outlet").select("id, nama, tgl_mulai, jam_operasional, skema:skema_bagi_hasil(nama, persen_sedekah, rincian)").eq("mode", "asli").is("deleted_at", null).order("tgl_mulai");
  const daftar = (outlets ?? []) as unknown as { id: string; nama: string; skema: { nama: string; persen_sedekah: number; rincian: Rincian[] } | null }[];
  const outlet = daftar.find((o) => o.id === sp.outlet) ?? daftar[0];
  if (!outlet) notFound();
  const kini = new Date(Date.now() + 7 * 3600_000);
  const bulan = /^\d{4}-\d{2}$/.test(sp.bulan ?? "") ? sp.bulan! : kini.toISOString().slice(0, 7);
  const periode = `${bulan}-01`;
  const sim = sp.sim === "1" && s.active.role === "owner";

  const [{ data: proy }, { data: prev }, { data: sekarang }, { data: kb }, { data: pj }, { data: kar }, { data: pt }, { data: tutup }] = await Promise.all([
    supabase.rpc("proyeksi_laporan", { p_outlet: outlet.id, p_periode: periode, p_mode: sim ? "simulasi" : "asli" }),
    supabase.from("laporan_bulanan").select(LAPORAN_COLS).eq("outlet_id", outlet.id).eq("mode", "asli").lt("periode", periode).is("deleted_at", null).order("periode", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("laporan_bulanan").select("id").eq("outlet_id", outlet.id).eq("mode", "asli").eq("periode", periode).is("deleted_at", null).maybeSingle(),
    supabase.from("kategori_biaya").select("nama, urutan").eq("grup", "beban").order("urutan"),
    supabase.from("perjanjian").select("modal_outlet, sewa_bulanan, bank, no_rekening, atas_nama, mitra(nama)").eq("outlet_id", outlet.id).eq("mode", "asli").is("deleted_at", null).limit(1).maybeSingle(),
    supabase.from("karyawan").select("nama, jabatan, is_spv").eq("outlet_id", outlet.id).eq("mode", "asli").eq("status", "aktif").is("deleted_at", null).order("nama"),
    supabase.from("perusahaan").select("nama, penandatangan_nama, penandatangan_jabatan, kota_terbit").limit(1).maybeSingle(),
    supabase.from("penutupan_bulan").select("ojol, koreksi_lain, persediaan_akhir, catatan").eq("outlet_id", outlet.id).eq("periode", periode).eq("mode", "asli").maybeSingle(),
  ]);
  const sebelum = prev as unknown as Laporan | null;
  // titipan (cheesecake & dessert): yang dibebankan hanya yang terjual × harga produsen
  const { data: rekapTitip } = await supabase.rpc("rekap_titipan", { p_outlet: outlet.id, p_periode: periode });
  return (
    <ProyeksiForm
      key={`${outlet.id}-${bulan}-${sim}`}
      outlets={daftar.map((o) => ({ id: o.id, nama: o.nama }))}
      outletId={outlet.id}
      bulan={bulan}
      sim={sim}
      bolehSim={s.active.role === "owner"}
      proy={proy as Proyeksi}
      sebelum={sebelum}
      sudahTerbit={sekarang?.id ?? null}
      kategori={(kb ?? []).map((k) => k.nama)}
      skema={outlet.skema}
      perjanjian={
        pj
          ? { modal: Number(pj.modal_outlet ?? 0), sewa: Number(pj.sewa_bulanan ?? 0), mitra: (pj.mitra as unknown as { nama: string } | null)?.nama ?? null, bank: pj.bank, no_rekening: pj.no_rekening, atas_nama: pj.atas_nama }
          : null
      }
      penutupan={sim ? null : (tutup as { ojol: Record<string, number>; koreksi_lain: number | null; persediaan_akhir: number | null; catatan: string | null } | null)}
      karyawan={(kar ?? []).map((k) => (k.is_spv ? `${k.nama} (SPV)` : k.nama))}
      penandatangan={{ nama: pt?.penandatangan_nama ?? null, jabatan: pt?.penandatangan_jabatan ?? null }}
      namaOutlet={sebelum?.nama_outlet ?? outlet.nama}
      titipan={((rekapTitip ?? []) as { nama: string; produsen: string; terjual: number; harga: number; tagihan: number }[]).filter((x) => x.terjual)}
    />
  );
}
