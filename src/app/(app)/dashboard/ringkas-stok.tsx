import Link from "next/link";
import type { Session } from "@/lib/session";
import { ambilStok, olah, qty } from "@/lib/stok-realtime";
import { supabaseServer } from "@/lib/supabase/server";

const GUDANG = ["owner", "admin_pusat", "finance", "admin_gudang"];

// Ringkasan stok real-time di dashboard: bahan yang habis / mau habis per lokasi + perkiraan habis.
export async function RingkasStok({ s }: { s: Session }) {
  const a = s.active!;
  const supabase = await supabaseServer();
  const { data: semua } = await supabase.from("outlet").select("id, nama").eq("mode", "asli").is("deleted_at", null).order("tgl_mulai");
  const outlets = a.role === "spv" ? (semua ?? []).filter((o) => o.id === a.outletId) : (semua ?? []);
  const lokasi = [...outlets, ...(GUDANG.includes(a.role) ? [{ id: "gudang", nama: "Gudang Pusat" }] : [])];
  const hasil = await Promise.all(lokasi.map((l) => ambilStok(supabase, l.id === "gudang" ? null : l.id)));
  const daftar = lokasi
    .map((l, i) => ({ l, rows: hasil[i].data ? olah(hasil[i].data!).filter((r) => ["habis", "kritis", "menipis"].includes(r.f.status)) : [] }))
    .filter((x) => x.rows.length);
  const total = daftar.reduce((t, x) => t + x.rows.length, 0);
  return (
    <section className={`rounded-2xl border-2 p-4 ${total ? "border-red-200 bg-red-50/40" : "border-green-200 bg-green-50/40"}`}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 className="mr-auto font-bold">📦 Stok real-time {total ? `· ${total} bahan perlu restock` : "· semua aman"}</h2>
        <Link href="/stok-realtime" className="rounded-lg bg-kopi-900 px-3 py-1.5 text-xs font-semibold text-white">
          Pantau stok →
        </Link>
      </div>
      {daftar.length === 0 && <p className="text-sm text-stone-600">Belum ada bahan yang mendekati habis.</p>}
      <div className="grid gap-2 md:grid-cols-2">
        {daftar.map(({ l, rows }) => (
          <Link key={l.id} href={`/stok-realtime?lokasi=${l.id}`} className="block rounded-xl border border-stone-200 bg-white p-3 hover:border-kopi-700">
            <p className="mb-1 text-sm font-semibold">
              {l.id === "gudang" ? "🏭" : "☕"} {l.nama} <span className="text-xs font-normal text-stone-500">({rows.length})</span>
            </p>
            <ul className="space-y-0.5 text-xs">
              {rows.slice(0, 5).map((r) => (
                <li key={r.id} className="flex justify-between gap-2">
                  <span className="truncate">
                    <span className={r.f.status === "menipis" ? "text-amber-600" : "text-red-600"}>●</span> {r.nama}
                  </span>
                  <span className="whitespace-nowrap tabular-nums text-stone-600">
                    {qty(Math.max(r.stok, 0), r)}
                    {r.f.status === "habis" ? " · habis" : r.f.hariTersisa !== null ? ` · ±${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(r.f.hariTersisa)} hari` : ""}
                  </span>
                </li>
              ))}
              {rows.length > 5 && <li className="text-stone-400">+{rows.length - 5} lainnya</li>}
            </ul>
          </Link>
        ))}
      </div>
    </section>
  );
}
