import { notFound } from "next/navigation";
import { hitung, LAPORAN_COLS, type Laporan } from "@/lib/laporan";
import type { Rincian } from "@/lib/skema-actions";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import type { AcuanBulanan } from "@/lib/simulasi-acuan";
import { SimulasiView } from "./simulasi-view";

// Simulasi kemitraan untuk calon mitra: proyeksi laba & BEP dari asumsi, bisa diisi dari rata-rata outlet berjalan.
export default async function Simulasi() {
  const s = await getSession();
  if (!s?.active || !["owner", "admin_pusat", "finance"].includes(s.active.role)) notFound();
  const supabase = await supabaseServer();
  const [{ data: skema, error: skemaError }, { data: outlets, error: outletError }] = await Promise.all([
    supabase.from("skema_bagi_hasil").select("id, nama, persen_sedekah, rincian").order("nama"),
    supabase.from("outlet").select("id, nama").eq("mode", "asli").is("deleted_at", null).order("nama"),
  ]);
  if (skemaError || outletError) throw new Error("Data simulasi belum dapat dimuat. Silakan coba kembali.");
  const acuan: AcuanBulanan[] = [];
  // Baca seluruh periode dalam halaman kecil, tidak terpotong batas 1.000 baris API.
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from("laporan_bulanan").select(LAPORAN_COLS)
      .eq("mode", "asli").is("deleted_at", null).order("periode", { ascending: false }).order("id")
      .range(offset, offset + 499);
    if (error) throw new Error("Laporan acuan belum dapat dimuat. Silakan coba kembali.");
    const rows = (data ?? []) as unknown as Laporan[];
    for (const l of rows) {
      const h = hitung(l);
      acuan.push({ outletId: l.outlet_id, periode: l.periode.slice(0, 7), omzet: h.totalPenjualan, hpp: h.hpp, beban: h.totalBeban - (Number(l.sedekah) || 0) });
    }
    if (rows.length < 500) break;
  }
  return (
    <SimulasiView
      skema={(skema ?? []).map((k) => {
        const r = (k.rincian ?? []) as Rincian[];
        return { id: k.id, nama: k.nama, sedekah: Number(k.persen_sedekah) || 0, mitra: r.filter((x) => !x.pengelola).reduce((t, x) => t + Number(x.persen), 0) };
      })}
      acuan={acuan}
      outlets={outlets ?? []}
      bulanIni={new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" }).slice(0, 7)}
    />
  );
}
