import Link from "next/link";
import { BellRing } from "lucide-react";
import { JudulHalaman, Kartu, Kosong } from "@/components/staf/ui";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

const waktu = (iso: string) => new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

// Notifikasi: izin diputus, tukar shift, jadwal terbit.
export default async function NotifikasiStaf() {
  const s = await getSession();
  if (!s) redirect("/login");
  const supabase = await supabaseServer();
  const { data } = await supabase.from("notifikasi").select("id, judul, isi, tautan, dibaca_at, created_at").eq("pengguna_id", s.userId).order("created_at", { ascending: false }).limit(50);
  const daftar = data ?? [];
  const belum = daftar.filter((n) => !n.dibaca_at).length;
  // dibuka = dibaca; penanda titik tetap tampil di kunjungan ini
  if (belum) await supabase.from("notifikasi").update({ dibaca_at: new Date().toISOString() }).eq("pengguna_id", s.userId).is("dibaca_at", null);
  return (
    <div className="mx-auto max-w-2xl">
      <JudulHalaman judul="Notifikasi" keterangan={belum ? `${belum} baru` : "Kabar izin, tukar shift, dan jadwal"} />
      <Kartu className="!p-2 sm:!p-3">
        {daftar.length ? (
          <ul className="divide-y divide-garis">
            {daftar.map((n) => (
              <li key={n.id}>
                <Link href={(n.tautan ?? "/karyawan").replace("/staf/pengajuan", "/karyawan/izin").replace(/^\/staf/, "/karyawan")} className="flex gap-3 rounded-2xl p-3 hover:bg-krem">
                  <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${n.dibaca_at ? "bg-transparent" : "bg-matur-500"}`} aria-label={n.dibaca_at ? undefined : "Belum dibaca"} />
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm ${n.dibaca_at ? "font-semibold text-kopi-700" : "font-bold text-kopi-900"}`}>{n.judul}</span>
                    {n.isi && <span className="mt-0.5 block text-[13px] text-redup">{n.isi}</span>}
                    <span className="mt-1 block text-[11px] text-redup">{waktu(n.created_at)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Kosong ikon={BellRing} judul="Belum ada notifikasi" keterangan="Kabar izin, tukar shift, dan jadwal baru akan muncul di sini." />
        )}
      </Kartu>
    </div>
  );
}
