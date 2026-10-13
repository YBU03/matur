import Link from "next/link";
import { notFound } from "next/navigation";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { buatPembelian } from "@/lib/gudang-actions";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { PembelianView } from "./pembelian-view";

const STATUS: Record<string, [string, string]> = { draft: ["📝 Draft", "bg-amber-100 text-amber-800"], diterima: ["✅ Diterima", "bg-green-100 text-green-800"], batal: ["Batal", "bg-stone-100 text-stone-500"] };

// Pembelian bahan ke supplier → setelah diterima, stok gudang pusat bertambah & harga beli bahan diperbarui.
export default async function Pembelian({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const s = await getSession();
  if (!s?.active || !["owner", "admin_pusat", "admin_gudang", "finance"].includes(s.active.role)) notFound();
  const bisa = s.active.role !== "finance";
  const { id } = await searchParams;
  const supabase = await supabaseServer();
  const { data: supplier } = await supabase.from("supplier").select("id, nama").eq("mode", "asli").is("deleted_at", null).order("nama");

  if (id) {
    const [{ data: g }, { data: items }, { data: bahan }] = await Promise.all([
      supabase.from("pembelian").select("id, nomor, tanggal, status, no_faktur, catatan, total, supplier_id").eq("id", id).maybeSingle(),
      supabase.from("item_pembelian").select("bahan_id, nama, satuan, konversi, qty, harga").eq("pembelian_id", id),
      supabase.from("bahan").select("id, nama, satuan_beli, satuan_pakai, konversi, harga_beli, supplier_id").eq("mode", "asli").is("deleted_at", null).order("nama"),
    ]);
    if (!g) notFound();
    return <PembelianView pembelian={g} items={items ?? []} bahan={bahan ?? []} supplier={supplier ?? []} bisaUbah={bisa} />;
  }

  const { data: rows } = await supabase.from("pembelian").select("id, nomor, tanggal, status, total, no_faktur, supplier:supplier(nama)").eq("mode", "asli").is("deleted_at", null).order("created_at", { ascending: false }).limit(100);
  const bulanIni = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 7);
  const totalBulan = (rows ?? []).filter((r) => r.status === "diterima" && r.tanggal.startsWith(bulanIni)).reduce((t, r) => t + Number(r.total), 0);
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Pembelian Supplier</h1>
        <p className="text-sm text-stone-500">Catat belanja bahan ke supplier. Saat ditandai diterima, stok gudang bertambah dan harga beli bahan memakai harga terakhir. Pembelian diterima bulan ini: <b>{formatRupiah(totalBulan)}</b></p>
      </div>
      {bisa && (
        <form action={buatPembelian} className="flex flex-wrap items-end gap-2 rounded-2xl border border-matur-200 bg-white p-3">
          <label className="min-w-48 flex-1 text-xs text-stone-600">
            Supplier
            <select name="supplier" className="mt-0.5 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm">
              <option value="">— tanpa supplier / beli di pasar —</option>
              {(supplier ?? []).map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nama}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-stone-600">
            Tanggal
            <input type="date" name="tanggal" defaultValue={new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)} className="mt-0.5 block rounded-xl border border-stone-300 px-3 py-2 text-sm" />
          </label>
          <label className="text-xs text-stone-600">
            No. faktur/nota
            <input name="faktur" className="mt-0.5 block w-36 rounded-xl border border-stone-300 px-3 py-2 text-sm" />
          </label>
          <button className="rounded-xl bg-matur-500 px-4 py-2 text-sm font-semibold text-white">+ Buat pembelian</button>
        </form>
      )}
      <ul className="space-y-2">
        {(rows ?? []).length === 0 && <li className="rounded-2xl border border-matur-200 bg-white p-6 text-center text-sm text-stone-400">Belum ada pembelian.</li>}
        {(rows ?? []).map((r) => (
          <li key={r.id}>
            <Link href={`/gudang/pembelian?id=${r.id}`} className="flex flex-wrap items-center gap-3 rounded-2xl border border-matur-200 bg-white p-3 hover:bg-matur-50">
              <div className="mr-auto">
                <p className="font-semibold">
                  {r.nomor} · {(r.supplier as unknown as { nama: string } | null)?.nama ?? "Tanpa supplier"}
                </p>
                <p className="text-xs text-stone-500">
                  {formatTanggal(r.tanggal)}
                  {r.no_faktur && ` · faktur ${r.no_faktur}`}
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS[r.status][1]}`}>{STATUS[r.status][0]}</span>
              <b className="w-32 text-right tabular-nums">{formatRupiah(r.total)}</b>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
