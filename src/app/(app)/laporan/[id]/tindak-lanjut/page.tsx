import { semuaHalaman } from "@/lib/paginasi-laporan";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { getSession } from "@/lib/session";
import { LAPORAN_COLS, type Laporan } from "@/lib/laporan";
import { LaporanHubLinks } from "@/components/laporan-hub-links";
import { TindakLanjutView, type History } from "./view";
import type { Bayar, HakBayar, Meeting } from "@/lib/laporan-rekap";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const s = await getSession();
  if (
    !s?.active ||
    !["owner", "admin_pusat", "finance", "mitra", "manajer_area"].includes(
      s.active.role,
    )
  )
    notFound();
  const { id } = await params;
  const db = await supabaseServer();
  const { data: l, error: le } = await db
    .from("laporan_bulanan")
    .select(LAPORAN_COLS)
    .eq("id", id)
    .eq("mode", "asli")
    .is("deleted_at", null)
    .maybeSingle();
  if (le) throw new Error(le.message);
  if (!l) notFound();
  const read = async <T,>(table: string, cols: string, sort: string) => ({
    data: await semuaHalaman<T>((a, b) =>
      db
        .from(table)
        .select(cols)
        .eq("laporan_id", id)
        .order(sort)
        .order("id")
        .range(a, b),
    ),
    error: null,
  });
  const [hak, bayar, meeting, ps, bh, mh] = await Promise.all([
    db.rpc("hak_pembayaran_laporan", { l: id }),
    read<Bayar>("laporan_bayar", "*", "created_at"),
    read<Meeting>("laporan_meeting", "*", "waktu"),
    db.rpc("peserta_meeting_laporan", { l: id }),
    read<History>(
      "laporan_bayar_riwayat",
      "id,bayar_id,sebelum,sesudah,alasan,aktor,created_at",
      "created_at",
    ),
    read<History>(
      "laporan_meeting_riwayat",
      "id,meeting_id,sebelum,sesudah,alasan,aktor,created_at",
      "created_at",
    ),
  ]);
  for (const r of [hak, bayar, meeting, ps, bh, mh])
    if (r.error) throw new Error(r.error.message);
  return (
    <>
      <LaporanHubLinks laporan={l as unknown as Laporan} />
      <TindakLanjutView
        laporan={l as unknown as Laporan}
        hak={hak.data as HakBayar[]}
        bayar={(bayar.data ?? []) as Bayar[]}
        meetings={(meeting.data ?? []) as Meeting[]}
        peserta={(ps.data ?? []) as { id: string; nama: string }[]}
        user={s.userId}
        pusat={["owner", "admin_pusat", "finance"].includes(s.active.role)}
        bisaMeeting={s.active.role !== "manajer_area"}
        riwayat={[...(bh.data ?? []), ...(mh.data ?? [])]}
      />
    </>
  );
}
