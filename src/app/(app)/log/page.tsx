import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge, ChipHeader, HeaderHalaman, Kosong, isian, tabel } from "@/components/ui-halaman";
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

function nadaAksi(aksi: string): "hijau" | "kuning" | "merah" | "biru" {
  const a = aksi.toLowerCase();
  if (/create|insert|tambah/.test(a)) return "hijau";
  if (/update|ubah/.test(a)) return "kuning";
  if (/delete|hapus|purge/.test(a)) return "merah";
  return "biru";
}

// buang karakter yang punya arti khusus di filter PostgREST
const bersih = (v: string | undefined) => (v ?? "").replace(/[%,()*\\:"']/g, " ").trim().slice(0, 80);
const tglValid = (v: string | undefined) => (/^\d{4}-\d{2}-\d{2}$/.test(v ?? "") ? v! : "");

// AKS-04: siapa, kapan, nilai lama dan baru
export default async function LogPage({ searchParams }: { searchParams: Promise<{ q?: string; pengguna?: string; dari?: string; sampai?: string }> }) {
  const s = await getSession();
  if (!s?.active || !findMenu(s.active.role, "/log")) notFound();
  const sp = await searchParams;
  const q = bersih(sp.q);
  const pengguna = bersih(sp.pengguna);
  const dari = tglValid(sp.dari);
  const sampai = tglValid(sp.sampai);
  const adaFilter = !!(q || pengguna || dari || sampai);
  const supabase = await supabaseServer();
  let query = supabase.from("log_view").select("*").order("waktu", { ascending: false }).limit(200);
  if (q) {
    // label Indonesia (mis. "hapus") ikut mencari kode aksi aslinya (delete)
    const kode = Object.entries(AKSI)
      .filter(([, l]) => l.toLowerCase().includes(q.toLowerCase()))
      .map(([k]) => `aksi.eq.${k}`);
    query = query.or([`aksi.ilike.*${q}*`, `entitas.ilike.*${q}*`, ...kode].join(","));
  }
  if (pengguna) query = query.ilike("pengguna_nama", `%${pengguna}%`);
  if (dari) query = query.gte("waktu", `${dari}T00:00:00+07:00`);
  if (sampai) query = query.lte("waktu", `${sampai}T23:59:59.999+07:00`);
  const { data } = await query;
  const logs = (data ?? []) as Log[];

  return (
    <div className="space-y-4">
      <HeaderHalaman judul="Log Aktivitas" ikon="📜" keterangan="Jejak siapa mengubah data apa dan kapan, lengkap dengan nilai lama dan baru.">
        <ChipHeader>{logs.length === 200 ? "200 aktivitas terbaru" : `${logs.length} aktivitas`}</ChipHeader>
        {adaFilter && <ChipHeader>🔎 Filter aktif</ChipHeader>}
      </HeaderHalaman>

      <form method="get" className="grid gap-2 rounded-2xl border border-matur-100 bg-white p-3 shadow-sm sm:grid-cols-2 lg:grid-cols-[2fr_1.5fr_1fr_1fr_auto] lg:items-end">
        <label className="text-xs font-medium text-stone-500">
          Cari aksi / data
          <input name="q" defaultValue={q} placeholder="mis. update, menu, bahan…" className={`${isian} mt-0.5 block w-full`} />
        </label>
        <label className="text-xs font-medium text-stone-500">
          Pengguna
          <input name="pengguna" defaultValue={pengguna} placeholder="nama pengguna" className={`${isian} mt-0.5 block w-full`} />
        </label>
        <label className="text-xs font-medium text-stone-500">
          Dari
          <input type="date" name="dari" defaultValue={dari} className={`${isian} mt-0.5 block w-full`} />
        </label>
        <label className="text-xs font-medium text-stone-500">
          Sampai
          <input type="date" name="sampai" defaultValue={sampai} className={`${isian} mt-0.5 block w-full`} />
        </label>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
          <button className="flex-1 rounded-xl bg-matur-500 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-matur-600 lg:flex-none">Terapkan</button>
          {adaFilter && (
            <Link href="/log" className="rounded-xl border border-matur-200 px-4 py-2 text-center text-sm font-semibold text-matur-700 hover:bg-matur-50">
              Reset
            </Link>
          )}
        </div>
      </form>

      {logs.length === 0 ? (
        <Kosong ikon="📜" judul={adaFilter ? "Tidak ada aktivitas yang cocok." : "Belum ada aktivitas."}>
          {adaFilter ? "Coba ubah kata kunci atau rentang tanggal." : "Perubahan data akan tercatat di sini."}
        </Kosong>
      ) : (
        <div className={tabel.bungkus}>
          <table className={`${tabel.tabel} min-w-[720px]`}>
            <thead className={tabel.kepala}>
              <tr>
                <th className={tabel.th}>Waktu</th>
                <th className={tabel.th}>Pengguna</th>
                <th className={tabel.th}>Aksi</th>
                <th className={tabel.th}>Data</th>
                <th className={tabel.th}>Perubahan</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => {
                const ubah = changes(l);
                return (
                  <tr key={l.id} className={`${tabel.baris} align-top even:bg-stone-50/60`}>
                    <td className={`${tabel.td} whitespace-nowrap text-xs tabular-nums text-stone-600`}>{formatTanggal(l.waktu, true)}</td>
                    <td className={`${tabel.td} whitespace-nowrap font-medium text-kopi-900`}>{l.pengguna_nama ?? <span className="text-stone-400">Sistem</span>}</td>
                    <td className={tabel.td}>
                      <Badge nada={nadaAksi(l.aksi)}>{AKSI[l.aksi] ?? l.aksi}</Badge>
                    </td>
                    <td className={tabel.td}>
                      <span className="font-medium">{l.entitas}</span>
                      {l.nilai_baru?.nama ? <span className="text-stone-500"> · {String(l.nilai_baru.nama)}</span> : ""}
                    </td>
                    <td className={`${tabel.td} max-w-md text-xs text-stone-600`}>
                      {ubah?.length ? (
                        <ul className="space-y-0.5">
                          {ubah.map((c, i) => (
                            <li key={i} className="break-words">
                              {c}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-stone-300">–</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
