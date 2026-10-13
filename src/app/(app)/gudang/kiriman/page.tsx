import { stokMenipis } from "@/lib/stok-menipis";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { buatKiriman } from "@/lib/kiriman-actions";
import { STATUS_KIRIMAN } from "@/lib/kiriman";
import { findMenu } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";


// Kiriman bahan baku gudang → outlet (gudang membuat & mengirim, outlet menerima)
export default async function DaftarKiriman({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const s = await getSession();
  if (!s?.active || !findMenu(s.active.role, "/gudang/kiriman")) notFound();
  const gudang = ["owner", "admin_pusat", "admin_gudang"].includes(s.active.role);
  const st = (await searchParams).status;
  const supabase = await supabaseServer();
  let q = supabase.from("kiriman").select("id, nomor, tanggal, status, total, outlet(nama), item_kiriman(count)").eq("mode", "asli").is("deleted_at", null).order("created_at", { ascending: false }).limit(200);
  if (st && STATUS_KIRIMAN[st]) q = q.eq("status", st);
  const [{ data }, { data: outlets }] = await Promise.all([
    q,
    gudang ? supabase.from("outlet").select("id, nama").eq("mode", "asli").is("deleted_at", null).order("nama") : Promise.resolve({ data: [] as { id: string; nama: string }[] }),
  ]);
  // kasir → gudang: stok outlet berkurang otomatis dari penjualan (resep); tampilkan bahan resep yang menipis
  const menipis = gudang ? await stokMenipis(outlets ?? []) : [];
  const rows = (data ?? []) as unknown as { id: string; nomor: string; tanggal: string; status: string; total: number; outlet: { nama: string } | null; item_kiriman: { count: number }[] }[];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{gudang ? "Kiriman ke Outlet" : "Kiriman Masuk"}</h1>
      {gudang && (
        <form action={buatKiriman} className="flex flex-wrap items-center gap-2 rounded-2xl border border-matur-200 bg-white p-3">
          <select name="outlet" required className="min-w-48 flex-1 rounded-xl border border-stone-300 px-3 py-2 text-sm">
            <option value="">— pilih outlet tujuan —</option>
            {(outlets ?? []).map((o) => (
              <option key={o.id} value={o.id}>
                {o.nama}
              </option>
            ))}
          </select>
          <button className="rounded-xl bg-matur-500 px-4 py-2 text-sm font-semibold text-white">+ Buat kiriman</button>
        </form>
      )}
      {menipis.map((m) => (
        <details key={m.outletId} className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4">
          <summary className="cursor-pointer font-bold">
            ⚠️ Stok {m.outlet} menipis: {m.items.length} bahan <span className="text-sm font-normal text-stone-600">(berkurang otomatis dari penjualan kasir)</span>
          </summary>
          <ul className="mt-2 grid gap-x-6 text-sm sm:grid-cols-2">
            {m.items.map((i) => (
              <li key={i.nama} className="flex justify-between border-b border-amber-200 py-1">
                <span>{i.nama}</span>
                <span className="tabular-nums text-stone-600">sisa {i.sisa}</span>
              </li>
            ))}
          </ul>
        </details>
      ))}
      <nav className="-mx-4 overflow-x-auto px-4">
        <div className="flex w-max gap-1.5">
          {[["", "Semua"], ...Object.entries(STATUS_KIRIMAN).map(([k, [l]]) => [k, l])].map(([k, l]) => (
            <Link key={k} href={k ? `/gudang/kiriman?status=${k}` : "/gudang/kiriman"} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${(st ?? "") === k ? "bg-kopi-900 text-white" : "border border-matur-200 bg-white text-kopi-700"}`}>
              {l}
            </Link>
          ))}
        </div>
      </nav>
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-matur-300 bg-white p-6 text-center text-sm text-stone-500">Belum ada kiriman.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((k) => (
            <li key={k.id}>
              <Link href={`/gudang/kiriman/${k.id}`} className="flex items-center gap-3 rounded-2xl border border-matur-200 bg-white p-4 hover:bg-matur-50">
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{k.nomor}</p>
                  <p className="text-xs text-stone-500">
                    {k.outlet?.nama} · {formatTanggal(k.tanggal)} · {k.item_kiriman?.[0]?.count ?? 0} barang
                  </p>
                </div>
                <div className="text-right">
                  <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${STATUS_KIRIMAN[k.status][1]}`}>{STATUS_KIRIMAN[k.status][0]}</span>
                  {k.total > 0 && <p className="mt-1 text-sm font-semibold tabular-nums">{formatRupiah(k.total)}</p>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
