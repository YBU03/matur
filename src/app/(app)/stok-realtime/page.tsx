import { notFound } from "next/navigation";
import { StokRealtimeView } from "@/components/stok-realtime-view";
import { getSession } from "@/lib/session";
import { ambilStok, ambilTitipan, hitungStatus, olah } from "@/lib/stok-realtime";
import { supabaseServer } from "@/lib/supabase/server";

const BOLEH = ["owner", "admin_pusat", "finance", "admin_gudang", "spv", "manajer_area"];
const GUDANG = ["owner", "admin_pusat", "finance", "admin_gudang"];

// Pemantauan stok real-time: outlet (berkurang tiap transaksi POS sesuai resep) & gudang pusat, + smart forecast.
export default async function StokRealtime({ searchParams }: { searchParams: Promise<{ lokasi?: string; sim?: string }> }) {
  const s = await getSession();
  if (!s?.active || !BOLEH.includes(s.active.role)) notFound();
  const sp = await searchParams;
  const supabase = await supabaseServer();
  const { data: semua } = await supabase.from("outlet").select("id, nama").eq("mode", "asli").is("deleted_at", null).order("tgl_mulai");
  const outlets = s.active.role === "spv" ? (semua ?? []).filter((o) => o.id === s.active!.outletId) : (semua ?? []);
  const lokasi = [...outlets, ...(GUDANG.includes(s.active.role) ? [{ id: "gudang", nama: "Gudang Pusat" }] : [])];
  if (!lokasi.length) notFound();
  const pilihan = lokasi.find((l) => l.id === sp.lokasi)?.id ?? lokasi[0].id;
  const mode = sp.sim === "1" && s.active.role === "owner" ? "simulasi" : "asli";
  const hasil = await Promise.all(lokasi.map((l) => ambilStok(supabase, l.id === "gudang" ? null : l.id, mode)));
  const ringkas = Object.fromEntries(lokasi.map((l, i) => [l.id, hasil[i].data ? hitungStatus(olah(hasil[i].data!)) : { habis: 0, kritis: 0, menipis: 0 }]));
  const idx = lokasi.findIndex((l) => l.id === pilihan);
  const d = hasil[idx];
  const titipan = pilihan === "gudang" ? [] : await ambilTitipan(supabase, pilihan, mode);
  if (!d.data) return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{d.error}</p>;
  return (
    <StokRealtimeView
      judul={`Stok Real-time · ${lokasi[idx].nama}${mode === "simulasi" ? " (simulasi)" : ""}`}
      lokasi={lokasi}
      pilihan={pilihan}
      basePath="/stok-realtime"
      rows={olah(d.data)}
      shift={d.data.shift}
      tutupTerakhir={d.data.tutup_terakhir}
      tampilRp
      pantau={[{ table: "stok" }, { table: "titipan_masuk" }]}
      ringkasLokasi={ringkas}
      titipan={titipan}
      linkSetor={`/titipan?outlet=${pilihan}`}
    />
  );
}
