import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, BarisAngka, ChipHeader, HeaderHalaman, KartuAngka, Kosong, isian } from "@/components/ui-halaman";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { buatPembelian } from "@/lib/gudang-actions";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { PembelianView } from "./pembelian-view";

// label & warna badge status, seragam dengan halaman kiriman
const STATUS_PEMBELIAN: Record<string, [string, "netral" | "hijau" | "merah"]> = { draft: ["Draft", "netral"], diterima: ["Diterima", "hijau"], batal: ["Batal", "merah"] };

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
  const list = rows ?? [];
  const totalBulan = list.filter((r) => r.status === "diterima" && r.tanggal.startsWith(bulanIni)).reduce((t, r) => t + Number(r.total), 0);
  const poBulan = list.filter((r) => r.status !== "batal" && r.tanggal.startsWith(bulanIni)).length;
  const menunggu = list.filter((r) => r.status === "draft");
  const nilaiMenunggu = menunggu.reduce((t, r) => t + Number(r.total), 0);
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <HeaderHalaman
        judul="Pembelian Supplier"
        ikon="🛒"
        keterangan="Catat belanja bahan ke supplier. Saat ditandai diterima, stok gudang bertambah dan harga beli bahan memakai harga terakhir."
      >
        <ChipHeader>Diterima bulan ini: {formatRupiah(totalBulan)}</ChipHeader>
        <ChipHeader>{list.length} pembelian terakhir</ChipHeader>
      </HeaderHalaman>

      <BarisAngka>
        <KartuAngka label="Pembelian diterima bulan ini" nilai={formatRupiah(totalBulan)} ikon="💰" nada="hijau" />
        <KartuAngka label="Jumlah PO bulan ini" nilai={poBulan} ikon="🧾" sub="tanpa yang batal" />
        <KartuAngka label="Menunggu diterima" nilai={menunggu.length} ikon="⏳" nada="kuning" sub="status draft" />
        <KartuAngka label="Nilai menunggu" nilai={formatRupiah(nilaiMenunggu)} ikon="📦" nada="biru" />
      </BarisAngka>

      {bisa && (
        <form action={buatPembelian} className="grid gap-2 rounded-2xl border border-matur-100 bg-white p-3 shadow-sm sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
          <label className="text-xs font-medium text-stone-600">
            Supplier
            <select name="supplier" className={`${isian} mt-0.5 block w-full`}>
              <option value="">— tanpa supplier / beli di pasar —</option>
              {(supplier ?? []).map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nama}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-stone-600">
            Tanggal
            <input type="date" name="tanggal" defaultValue={new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)} className={`${isian} mt-0.5 block w-full`} />
          </label>
          <label className="text-xs font-medium text-stone-600">
            No. faktur/nota
            <input name="faktur" className={`${isian} mt-0.5 block w-full sm:w-40`} />
          </label>
          <button className="rounded-xl bg-matur-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-matur-600">+ Buat pembelian</button>
        </form>
      )}
      {list.length === 0 ? (
        <Kosong ikon="🛒" judul="Belum ada pembelian.">
          {bisa ? "Buat pembelian baru lewat formulir di atas." : "Pembelian dari gudang akan tampil di sini."}
        </Kosong>
      ) : (
        <ul className="space-y-2">
          {list.map((r) => {
            const [label, nada] = STATUS_PEMBELIAN[r.status] ?? ([r.status, "netral"] as const);
            return (
              <li key={r.id}>
                <Link href={`/gudang/pembelian?id=${r.id}`} className="flex items-center gap-3 rounded-2xl border border-matur-100 bg-white p-3 shadow-sm transition hover:border-matur-300 hover:bg-matur-50/50 sm:p-4">
                  <span className="hidden size-10 shrink-0 place-items-center rounded-xl bg-matur-50 text-lg sm:grid">🧾</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-kopi-900">
                      {r.nomor} · {(r.supplier as unknown as { nama: string } | null)?.nama ?? "Tanpa supplier"}
                    </p>
                    <p className="truncate text-xs text-stone-500">
                      {formatTanggal(r.tanggal)}
                      {r.no_faktur && ` · faktur ${r.no_faktur}`}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <Badge nada={nada}>{label}</Badge>
                    <p className="mt-1 text-sm font-bold tabular-nums text-kopi-900">{formatRupiah(r.total)}</p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
