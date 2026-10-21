import { supabaseServer } from "@/lib/supabase/server";
import { LoncengMenu, type ItemLonceng } from "./lonceng-menu";

// Lonceng Owner/Admin Pusat: peringatan penting (kas tertinggal, kas belum dihitung, pendaftar) + notifikasi terbaru.
export async function Lonceng({ userId }: { userId: string }) {
  const db = await supabaseServer();
  const [kas, oto, daftar, notif] = await Promise.all([
    db.rpc("kas_tertinggal"),
    db.rpc("riwayat_kas_otomatis"),
    db.from("pengguna").select("id", { count: "exact", head: true }).eq("status", "menunggu"),
    db.from("notifikasi").select("id, judul, isi, tautan, dibaca_at, created_at").eq("pengguna_id", userId).order("created_at", { ascending: false }).limit(8),
  ]);
  const tertinggal = (kas.data ?? []) as { outlet: string }[];
  const belumDihitung = ((oto.data ?? []) as { dihitung_at: string | null }[]).filter((k) => !k.dihitung_at).length;
  const pendaftar = daftar.count ?? 0;

  const penting: ItemLonceng[] = [];
  if (tertinggal.length)
    penting.push({
      id: "kas-tertinggal",
      ikon: "⚠️",
      nada: "merah",
      judul: `${tertinggal.length} kas POS tertinggal`,
      isi: `${[...new Set(tertinggal.map((k) => k.outlet))].join(", ")} — belum ditutup setelah shift berakhir.`,
      tautan: "/pengaturan/pos#tertinggal",
    });
  if (belumDihitung)
    penting.push({
      id: "kas-otomatis",
      ikon: "🕛",
      nada: "kuning",
      judul: `${belumDihitung} kas ditutup otomatis belum dihitung`,
      isi: "Isi hitungan uang fisik agar selisih kas tercatat.",
      tautan: "/pengaturan/pos#riwayat-kas",
    });
  if (pendaftar)
    penting.push({
      id: "pendaftar",
      ikon: "🙋",
      nada: "kuning",
      judul: `${pendaftar} pendaftar baru menunggu`,
      isi: "Tentukan peran dan outlet di Pengguna & Akses.",
      tautan: "/pengguna",
    });
  const terbaru = ((notif.data ?? []) as { id: string; judul: string; isi: string | null; tautan: string | null; dibaca_at: string | null; created_at: string }[]).map((n) => ({
    id: n.id,
    ikon: "🔔",
    nada: "netral" as const,
    judul: n.judul,
    isi: n.isi ?? "",
    tautan: n.tautan,
    baru: !n.dibaca_at,
    waktu: n.created_at,
  }));
  return <LoncengMenu penting={penting} terbaru={terbaru} />;
}
