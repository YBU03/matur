import { stokMenipis } from "@/lib/stok-menipis";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, BarisAngka, ChipHeader, HeaderHalaman, KartuAngka, Kosong, isian } from "@/components/ui-halaman";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { buatKiriman } from "@/lib/kiriman-actions";
import { STATUS_KIRIMAN } from "@/lib/kiriman";
import { findMenu } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

// warna badge status, seragam dengan halaman pembelian
const NADA_STATUS: Record<string, "netral" | "biru" | "hijau" | "merah"> = { draft: "netral", dikirim: "biru", diterima: "hijau", batal: "merah" };

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
  const hitung = (k: string) => rows.filter((r) => r.status === k).length;
  const filterAktif = st && STATUS_KIRIMAN[st] ? STATUS_KIRIMAN[st][0] : null;

  return (
    <div className="space-y-4">
      <HeaderHalaman
        judul={gudang ? "Kiriman ke Outlet" : "Kiriman Masuk"}
        ikon="🚚"
        keterangan={gudang ? "Kirim bahan baku dari gudang pusat ke outlet. Outlet mengonfirmasi saat barang diterima." : "Bahan baku dari gudang pusat untuk outlet Anda. Konfirmasi saat barang sudah diterima."}
      >
        <ChipHeader>{rows.length} kiriman{filterAktif ? ` · ${filterAktif}` : ""}</ChipHeader>
        {menipis.length > 0 && <ChipHeader>⚠️ {menipis.length} outlet stok menipis</ChipHeader>}
      </HeaderHalaman>

      <BarisAngka>
        <KartuAngka label="Draft" nilai={hitung("draft")} ikon="📝" sub="belum dikirim" />
        <KartuAngka label="Dalam perjalanan" nilai={hitung("dikirim")} ikon="🚚" nada="biru" sub="menunggu diterima" />
        <KartuAngka label="Diterima" nilai={hitung("diterima")} ikon="✅" nada="hijau" sub="sudah sampai outlet" />
        <KartuAngka label="Nilai kiriman" nilai={formatRupiah(rows.filter((r) => r.status !== "batal").reduce((t, r) => t + Number(r.total ?? 0), 0))} ikon="💰" nada="kuning" sub="tanpa yang batal" />
      </BarisAngka>

      {gudang && (
        <form action={buatKiriman} className="flex flex-col gap-2 rounded-2xl border border-matur-100 bg-white p-3 shadow-sm sm:flex-row sm:items-center">
          <select name="outlet" required className={`${isian} w-full sm:flex-1`}>
            <option value="">— pilih outlet tujuan —</option>
            {(outlets ?? []).map((o) => (
              <option key={o.id} value={o.id}>
                {o.nama}
              </option>
            ))}
          </select>
          <button className="rounded-xl bg-matur-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-matur-600">+ Buat kiriman</button>
        </form>
      )}
      {menipis.map((m) => (
        <details key={m.outletId} className="rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-sm">
          <summary className="cursor-pointer font-bold text-amber-900">
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
            <Link
              key={k}
              href={k ? `/gudang/kiriman?status=${k}` : "/gudang/kiriman"}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${(st ?? "") === k ? "bg-kopi-900 text-white shadow-sm" : "border border-matur-200 bg-white text-kopi-700 hover:bg-matur-50"}`}
            >
              {l}
            </Link>
          ))}
        </div>
      </nav>
      {rows.length === 0 ? (
        <Kosong ikon="🚚" judul="Belum ada kiriman.">
          {gudang ? "Buat kiriman baru dengan memilih outlet tujuan di atas." : "Kiriman dari gudang akan tampil di sini."}
        </Kosong>
      ) : (
        <ul className="space-y-2">
          {rows.map((k) => (
            <li key={k.id}>
              <Link href={`/gudang/kiriman/${k.id}`} className="flex items-center gap-3 rounded-2xl border border-matur-100 bg-white p-4 shadow-sm transition hover:border-matur-300 hover:bg-matur-50/50">
                <span className="hidden size-10 shrink-0 place-items-center rounded-xl bg-matur-50 text-lg sm:grid">📦</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-kopi-900">{k.nomor}</p>
                  <p className="truncate text-xs text-stone-500">
                    {k.outlet?.nama} · {formatTanggal(k.tanggal)} · {k.item_kiriman?.[0]?.count ?? 0} barang
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <Badge nada={NADA_STATUS[k.status] ?? "netral"}>{STATUS_KIRIMAN[k.status]?.[0] ?? k.status}</Badge>
                  {k.total > 0 && <p className="mt-1 text-sm font-semibold tabular-nums text-kopi-900">{formatRupiah(k.total)}</p>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
