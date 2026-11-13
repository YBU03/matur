import { OpnameOutlet } from "@/components/opname-outlet";
import {
  PenerimaanBelanja,
  type BelanjaBahan,
} from "@/components/penerimaan-belanja";
import { PosRiwayatShift } from "@/components/pos-riwayat-shift";
import { PosAlurShift } from "@/components/pos-alur-shift";
import { PosModalKas } from "@/components/pos-modal-kas";
import { notFound } from "next/navigation";
import { POS_ROLES } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { statusPos } from "@/lib/pos-tim";
import { TutupKasTim, type KasTim } from "@/components/tutup-kas-tim";
import { supabaseServer } from "@/lib/supabase/server";
import { KasView, type Catatan } from "./kas-view";
import { tglOperasional } from "@/lib/hari-operasional";
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
  // hari operasional (tutup buku 03.00): pengeluaran 00.00–03.00 masih milik hari yang sama
  const hari = tglOperasional();
  const tujuhHari = new Date(Date.parse(`${hari}T00:00:00Z`) - 6 * 86400_000).toISOString().slice(0, 10);
  const [
    { data: kat, error: katError },
    { data: sesiBuka },
    { data: catatan, error: catatanError },
    { data: menu },
    { data: produk, error: produkError },
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
      .gte("tanggal", tujuhHari)
      .lte("tanggal", hari)
      .is("deleted_at", null)
      .order("tanggal", { ascending: false })
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
  if (katError || catatanError || produkError)
    throw new Error(
      "Data pengeluaran belum dapat dimuat: " +
        (katError ?? catatanError ?? produkError)!.message,
    );
  // tandai pengeluaran yang kas shift-nya sudah ditutup (kategori/keterangan tetap bisa diperbaiki)
  const idSesi = [...new Set((catatan ?? []).map((c) => c.sesi_kas_id).filter((x): x is string => !!x))];
  const { data: sesiFinal } = idSesi.length
    ? await supabase.from("sesi_kas").select("id").in("id", idSesi).not("ditutup_at", "is", null)
    : { data: [] as { id: string }[] };
  const final = new Set((sesiFinal ?? []).map((x) => x.id));
  const { data: belanja, error: belanjaError } = await supabase
    .from("belanja_bahan_outlet")
    .select("*")
    .eq("outlet_id", outlet)
    .order("created_at", { ascending: false })
    .limit(100);
  if (belanjaError) throw new Error(belanjaError.message);
  const so=<OpnameOutlet embedded sesiKasId={sesiId??undefined} searchParams={Promise.resolve({outlet})}/>;
  return (
    <div className="space-y-4">
      {pos.alur_shift && (
        <PosAlurShift outletId={outlet} status={pos} outlet={s.active.outletNama} kelola opname={so} />
      )}
      {!pos.alur_shift && pos.sesi && (
        <PosModalKas
          key={pos.sesi.id}
          sesi={pos.sesi.id}
          modal={pos.sesi.modal}
        />
      )}
      {!pos.alur_shift && kasTim && (
        <div id="tutup" className="scroll-mt-20">
          <TutupKasTim
            outlet={outlet}
            opname={so}
            kas={{ ...(kasTim as KasTim), kas_harian: pos.sesi?.kas_harian }}
          />
        </div>
      )}
      <PenerimaanBelanja data={(belanja ?? []) as BelanjaBahan[]} />
      <PosRiwayatShift outlet={outlet} />
      <KasView
        kategori={(kat ?? []) as { id: string; nama: string; grup: string }[]}
        catatan={((catatan ?? []) as unknown as Catatan[]).map((c) => ({ ...c, final: !!c.sesi_kas_id && final.has(c.sesi_kas_id) }))}
        hari={hari}
        meId={s.userId}
        sesi={null}
        adaShiftBuka={(sesiBuka ?? []).length > 0}
        ringkas={null}
        outletNama={s.active.outletNama}
        spv={s.active.role === "spv"}
      />
      <div id="endorse" className="mx-auto max-w-3xl scroll-mt-20">
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
