import { notFound } from "next/navigation";
import { formatTanggal } from "@/lib/format";
import { findMenu } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

type Log = {
  id: number;
  aksi: string;
  entitas: string;
  waktu: string;
  pengguna_nama: string | null;
  nilai_lama: Record<string, unknown> | null;
  nilai_baru: Record<string, unknown> | null;
};

const AKSI: Record<string, string> = { create: "Tambah", update: "Ubah", delete: "Hapus", restore: "Pulihkan", purge: "Hapus permanen" };
const SKIP = new Set(["id", "mode", "created_at", "deleted_at"]);

function changes(l: Log) {
  if (!l.nilai_lama || !l.nilai_baru) return null;
  return Object.keys(l.nilai_baru)
    .filter((k) => !SKIP.has(k) && JSON.stringify(l.nilai_lama![k]) !== JSON.stringify(l.nilai_baru![k]))
    .map((k) => `${k}: ${l.nilai_lama![k] ?? "-"} → ${l.nilai_baru![k] ?? "-"}`);
}

// AKS-04: siapa, kapan, nilai lama dan baru
export default async function LogPage() {
  const s = await getSession();
  if (!s?.active || !findMenu(s.active.role, "/log")) notFound();
  const supabase = await supabaseServer();
  const { data } = await supabase.from("log_view").select("*").order("waktu", { ascending: false }).limit(200);
  const logs = (data ?? []) as Log[];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Log Aktivitas</h1>
      <div className="overflow-x-auto rounded-2xl border border-matur-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-matur-50 text-left text-kopi-700">
            <tr>
              <th className="px-3 py-2">Waktu</th>
              <th className="px-3 py-2">Pengguna</th>
              <th className="px-3 py-2">Aksi</th>
              <th className="px-3 py-2">Data</th>
              <th className="px-3 py-2">Perubahan</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-t border-stone-100 align-top">
                <td className="whitespace-nowrap px-3 py-2">{formatTanggal(l.waktu, true)}</td>
                <td className="px-3 py-2">{l.pengguna_nama ?? "Sistem"}</td>
                <td className="px-3 py-2">{AKSI[l.aksi] ?? l.aksi}</td>
                <td className="px-3 py-2">
                  {l.entitas}
                  {l.nilai_baru?.nama ? ` · ${l.nilai_baru.nama}` : ""}
                </td>
                <td className="px-3 py-2 text-xs text-stone-600">{changes(l)?.join("; ") ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
