import { FilterPeriodeTitipan } from "@/components/filter-periode-titipan";
import {
  PERIODE_TITIPAN,
  tautanTitipan,
  periodeTitipan,
  type PeriodeTitipan,
} from "@/lib/periode-titipan";
import { notFound } from "next/navigation";
import { PilihOutlet } from "@/components/pilih-outlet";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { TitipanView, type RekapTitipan } from "./titipan-view";

const BOLEH = [
  "owner",
  "admin_pusat",
  "finance",
  "hrd",
  "admin_gudang",
  "spv",
  "manajer_area",
];

// Produk titipan (cheesecake & dessert dari produsen): setoran masuk, terjual (otomatis dari POS), sisa, tagihan.
export default async function Titipan({
  searchParams,
}: {
  searchParams: Promise<{
    outlet?: string;
    bulan?: string;
    periode?: string;
    tanggal?: string;
    akhir?: string;
  }>;
}) {
  const s = await getSession();
  if (!s?.active || !BOLEH.includes(s.active.role)) notFound();
  const sp = await searchParams;
  const supabase = await supabaseServer();
  const { data: semua } = await supabase
    .from("outlet")
    .select("id, nama")
    .eq("mode", "asli")
    .is("deleted_at", null)
    .order("tgl_mulai");
  const outlets =
    s.active.role === "spv"
      ? (semua ?? []).filter((o) => o.id === s.active!.outletId)
      : (semua ?? []);
  const outlet = outlets.find((o) => o.id === sp.outlet) ?? outlets[0];
  if (!outlet) notFound();
  const periode: PeriodeTitipan = PERIODE_TITIPAN.includes(
    sp.periode as PeriodeTitipan,
  )
    ? (sp.periode as PeriodeTitipan)
    : "bulanan";
  const hariIni = new Date(Date.now() + 7 * 3600_000)
    .toISOString()
    .slice(0, 10);
  let tanggal = sp.tanggal ?? (sp.bulan ? `${sp.bulan}-01` : hariIni);
  let rentang;
  try {
    rentang = periodeTitipan(tanggal, periode, sp.akhir);
  } catch (e) {
    tanggal = hariIni;
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <h1 className="text-2xl font-bold">Titipan Produk</h1>
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
        >
          {(e as Error).message} Pilih ulang rentang tanggal untuk menampilkan
          rekap.
        </p>
        <FilterPeriodeTitipan
          key={`invalid-${sp.tanggal}-${sp.akhir}`}
          outletId={outlet.id}
          tanggal={tanggal}
          periode={periode}
          akhir={tanggal}
        />
      </div>
    );
  }
  const { awal, akhir } = rentang;
  const [
    { data: rekap, error: e1 },
    { data: menu, error: e2 },
    { data: riwayat, error: e3 },
  ] = await Promise.all([
    supabase.rpc("rekap_titipan_rentang", {
      p_outlet: outlet.id,
      p_awal: awal,
      p_akhir: akhir,
    }),
    supabase
      .from("menu")
      .select("id, nama, produsen, harga_titip")
      .eq("mode", "asli")
      .eq("titipan", true)
      .is("deleted_at", null)
      .order("nama"),
    supabase
      .from("titipan_masuk")
      .select(
        "id, menu_id, tanggal, qty, jenis, catatan, nama_pembuat, created_at",
      )
      .eq("outlet_id", outlet.id)
      .gte("tanggal", awal)
      .lte("tanggal", akhir)
      .order("created_at", { ascending: false }),
  ]);
  if (e1 || e2 || e3) throw new Error((e1 ?? e2 ?? e3)!.message);
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Titipan Produk</h1>
        <p className="text-sm text-stone-500">
          Barang titipan produsen (mis. Bu Ratna). Barang masuk tidak dibebankan
          — yang menjadi HPP hanya yang <b>terjual</b> (tercatat otomatis dari
          kasir) × harga produsen.
        </p>
      </div>
      <PilihOutlet
        outlets={outlets}
        pilih={outlet.id}
        href={(id) => tautanTitipan(id, tanggal, periode, akhir)}
      />
      <FilterPeriodeTitipan
        key={`${outlet.id}-${tanggal}-${periode}-${akhir}`}
        outletId={outlet.id}
        tanggal={tanggal}
        periode={periode}
        akhir={akhir}
      />
      <TitipanView
        outletId={outlet.id}
        awal={awal}
        akhir={akhir}
        rekap={(rekap ?? []) as RekapTitipan[]}
        menu={menu ?? []}
        riwayat={riwayat ?? []}
      />
    </div>
  );
}
