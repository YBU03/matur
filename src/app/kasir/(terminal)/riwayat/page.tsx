import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { RiwayatView, type DraftRiwayat, type Ringkas, type Trx } from "./riwayat-view";

const TGL = /^\d{4}-\d{2}-\d{2}$/;
const hariWib = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
const geser = (iso: string, hari: number) => new Date(Date.parse(iso + "T00:00:00Z") + hari * 86400_000).toISOString().slice(0, 10);
const MAKS_HARI = 92;

// Riwayat transaksi outlet ini per periode (default hari ini, maks. 3 bulan); struk bisa dibuka, diunduh & dicetak ulang.
export default async function Riwayat({ searchParams }: { searchParams: Promise<{ tab?: string; dari?: string; sampai?: string; n?: string }> }) {
  const sp = await searchParams;
  const tab = sp.tab === "draft" ? "draft" : "trx";
  const s = (await getSession())!;
  const outlet = s.active!.outletId!;
  const hari = hariWib();
  let dari = TGL.test(sp.dari ?? "") ? sp.dari! : hari;
  let sampai = TGL.test(sp.sampai ?? "") ? sp.sampai! : dari;
  if (sampai > hari) sampai = hari;
  if (dari > sampai) dari = sampai;
  if (geser(dari, MAKS_HARI - 1) < sampai) dari = geser(sampai, -(MAKS_HARI - 1));
  const n = Math.min(Math.max(Number(sp.n) || 100, 100), 1000);
  const mulai = `${dari}T00:00:00+07:00`;
  const akhir = `${geser(sampai, 1)}T00:00:00+07:00`;
  const supabase = await supabaseServer();
  const seminggu = new Date(Date.now() - 7 * 86400_000).toISOString();

  const [{ data }, { data: drafts }] = await Promise.all([
    supabase
      .from("transaksi")
      .select("id, nomor, kanal, subtotal, total, diskon, status, void_alasan, created_at, pelanggan, operator_nama, item_transaksi(nama, qty, harga), pembayaran(metode, nominal, diterima)")
      .eq("mode", "asli")
      .eq("outlet_id", outlet)
      .gte("created_at", mulai)
      .lt("created_at", akhir)
      .order("created_at", { ascending: false })
      .limit(n + 1),
    supabase
      .from("pesanan_draft")
      .select("id, label, items, total, status, alasan_batal, nama_pembuat, nama_penutup, created_at, selesai_at, transaksi:transaksi!pesanan_draft_transaksi_id_fkey(nomor)")
      .eq("outlet_id", outlet)
      .or(`status.eq.draft,created_at.gte.${seminggu}`)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  // ringkasan seluruh periode (bukan hanya baris yang dimuat), diambil bertahap per 1000 baris
  const ringkas: Ringkas = { transaksi: 0, omzet: 0, void: 0, metode: {} };
  for (let dariBaris = 0; dariBaris < 50_000; dariBaris += 1000) {
    const { data: hal } = await supabase
      .from("transaksi")
      .select("total, status, pembayaran(metode, nominal)")
      .eq("mode", "asli")
      .eq("outlet_id", outlet)
      .gte("created_at", mulai)
      .lt("created_at", akhir)
      .order("id")
      .range(dariBaris, dariBaris + 999);
    for (const t of (hal ?? []) as { total: number; status: string; pembayaran: { metode: string; nominal: number }[] }[]) {
      if (t.status !== "lunas") {
        ringkas.void++;
        continue;
      }
      ringkas.transaksi++;
      ringkas.omzet += Number(t.total);
      for (const p of t.pembayaran) ringkas.metode[p.metode] = (ringkas.metode[p.metode] ?? 0) + Number(p.nominal);
    }
    if (!hal || hal.length < 1000) break;
  }

  const rows = (data ?? []) as unknown as Trx[];
  return (
    <RiwayatView
      key={`${dari}:${sampai}`}
      trx={rows.slice(0, n)}
      adaLagi={rows.length > n}
      n={n}
      ringkas={ringkas}
      dari={dari}
      sampai={sampai}
      hari={hari}
      drafts={(drafts ?? []) as unknown as DraftRiwayat[]}
      outletNama={s.active!.outletNama}
      awal={tab}
    />
  );
}
