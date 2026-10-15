import { notFound } from "next/navigation";
import { POS_ROLES } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { statusPos } from "@/lib/pos-tim";
import { TutupKasTim, type KasTim } from "@/components/tutup-kas-tim";
import { supabaseServer } from "@/lib/supabase/server";
import { KasView, type Catatan } from "./kas-view";
import { ProdukMarketing, type ProdukHariIni } from "./produk-marketing";

// Kas & pengeluaran harian outlet (sheet "Transaksi" Ruma): catat pengeluaran, lihat ringkasan shift, tutup shift
export default async function KasPage() {
  const s = await getSession();
  if (!s?.active?.outletId || !POS_ROLES.includes(s.active.role)) notFound();
  const outlet = s.active.outletId;
  const supabase = await supabaseServer();
  const pos = await statusPos(outlet);
  let sesiId = pos.sesi && !pos.sesi.legacy ? pos.sesi.id : null;
  if (!sesiId && pos.device) {
    const { data: akhir } = await supabase
      .from("sesi_kas")
      .select("id")
      .eq("outlet_id", outlet)
      .eq("perangkat_id", pos.device.id)
      .eq("pos_tim", true)
      .order("dibuka_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    sesiId = akhir?.id ?? null;
  }
  const { data: kasTim } = sesiId
    ? await supabase.rpc("ringkasan_kas_tim", { p_sesi: sesiId })
    : { data: null };
  const hari = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  const [
    { data: kat },
    { data: sesiBuka },
    { data: catatan },
    { data: menu },
    { data: produk },
  ] = await Promise.all([
    supabase
      .from("kategori_biaya")
      .select("id, nama, grup")
      .eq("harian", true)
      .order("urutan"),
    supabase
      .from("sesi_kas")
      .select("id")
      .eq("mode", "asli")
      .eq("outlet_id", outlet)
      .is("ditutup_at", null)
      .limit(1),
    supabase
      .from("biaya_outlet")
      .select(
        "id, tanggal, kategori_id, jumlah, keterangan, sumber, sesi_kas_id, dibuat_oleh, created_at, pengguna:pengguna!biaya_outlet_dibuat_oleh_fkey(nama)",
      )
      .eq("mode", "asli")
      .eq("outlet_id", outlet)
      .eq("tanggal", hari)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("menu")
      .select("id, nama")
      .eq("mode", "asli")
      .is("deleted_at", null)
      .order("nama"),
    supabase
      .from("produk_keluar")
      .select("id, jenis, penerima, items, total_hpp, nama_pembuat, catatan")
      .eq("mode", "asli")
      .eq("outlet_id", outlet)
      .eq("tanggal", hari)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
  ]);
  return (
    <div className="space-y-4">
      {kasTim && <TutupKasTim kas={kasTim as KasTim} />}
      <KasView
        kategori={(kat ?? []) as { id: string; nama: string; grup: string }[]}
        catatan={(catatan ?? []) as unknown as Catatan[]}
        meId={s.userId}
        sesi={null}
        adaShiftBuka={(sesiBuka ?? []).length > 0}
        ringkas={null}
        outletNama={s.active.outletNama}
        spv={s.active.role === "spv"}
      />
      <div className="mx-auto max-w-3xl">
        <ProdukMarketing
          outletId={outlet}
          menu={menu ?? []}
          data={(produk ?? []) as ProdukHariIni[]}
          spv={s.active.role === "spv"}
        />
      </div>
    </div>
  );
}
