import { notFound } from "next/navigation";
import { BarisAngka, ChipHeader, HeaderHalaman, KartuAngka } from "@/components/ui-halaman";
import { formatRupiah } from "@/lib/format";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { TambahHpp } from "./tambah-hpp";
import { PilihMenu } from "./pilih-menu";
import { DaftarHpp, type Hpp } from "./daftar-hpp";


// HPP per menu (dari file HPP RUMA): biaya bahan per cup dan margin terhadap harga jual
export default async function HppMenu() {
  const s = await getSession();
  if (!s?.active || !["owner", "admin_pusat", "admin_gudang", "finance"].includes(s.active.role)) notFound();
  const bisaUbah = s.active.role !== "finance";
  const supabase = await supabaseServer();
  const [{ data: h }, { data: m }, { data: bahan }, { data: kategori }, { data: resep }] = await Promise.all([
    supabase.from("hpp_menu").select("id, menu_id, nama_hpp, seri, komponen, total_hpp, harga_jual").is("deleted_at", null),
    supabase.from("menu").select("id, nama, harga_langsung, kategori_menu(nama, urutan), urutan").eq("mode", "asli").is("deleted_at", null).order("urutan"),
    supabase.from("bahan").select("id, nama, satuan_pakai, harga_pokok").eq("mode", "asli").is("deleted_at", null).order("nama"),
    supabase.from("kategori_menu").select("id, nama").is("deleted_at", null).order("nama"),
    supabase.from("resep").select("menu_id").eq("mode", "asli").is("deleted_at", null),
  ]);
  const hpp = (h ?? []) as Hpp[];
  const menus = (m ?? []) as unknown as { id: string; nama: string; harga_langsung: number; kategori_menu: { nama: string; urutan: number } | null }[];
  const lepas = hpp.filter((x) => !x.menu_id);
  const opsi = menus.map((x) => ({ id: x.id, nama: x.nama }));

  // ringkasan dari data yang sudah dimuat
  const marginMenu = menus.map((menu) =>
    hpp
      .filter((x) => x.menu_id === menu.id)
      .map((x) => {
        const jual = x.harga_jual ?? menu.harga_langsung;
        return jual ? Math.round(((jual - x.total_hpp) / jual) * 100) : 0;
      }),
  );
  const semuaMargin = marginMenu.flat();
  const rataMargin = semuaMargin.length ? Math.round(semuaMargin.reduce((t, m) => t + m, 0) / semuaMargin.length) : null;
  const marginRendah = marginMenu.filter((m) => m.some((x) => x < 45)).length;
  const tanpaHpp = marginMenu.filter((m) => m.length === 0).length;

  return (
    <div className="space-y-4">
      <HeaderHalaman judul="HPP Menu" ikon="☕" keterangan="Biaya bahan per menu dan margin harga jual POS. Tambahkan HPP beserta resep untuk menu baru.">
        <ChipHeader>{hpp.length} data HPP</ChipHeader>
        {lepas.length > 0 && <ChipHeader>⚠️ {lepas.length} belum terhubung</ChipHeader>}
      </HeaderHalaman>

      <BarisAngka>
        <KartuAngka label="Jumlah menu" nilai={menus.length} ikon="☕" />
        <KartuAngka label="Rata-rata margin" nilai={rataMargin === null ? "–" : `${rataMargin}%`} ikon="📈" nada={rataMargin === null ? "netral" : rataMargin >= 60 ? "hijau" : rataMargin >= 45 ? "kuning" : "merah"} sub={`dari ${semuaMargin.length} varian`} />
        <KartuAngka label="Menu margin < 45%" nilai={marginRendah} ikon="⚠️" nada="merah" sub="perlu ditinjau" />
        <KartuAngka label="Menu tanpa HPP" nilai={tanpaHpp} ikon="❔" nada="kuning" sub="belum ada data" />
      </BarisAngka>

      {bisaUbah && <TambahHpp menus={menus.filter((m) => !(resep ?? []).some((r) => r.menu_id === m.id) && !hpp.some((h) => h.menu_id === m.id))} bahan={bahan ?? []} kategori={kategori ?? []} />}
      {lepas.length > 0 && (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-sm">
          <h2 className="font-bold text-amber-900">HPP belum terhubung ke menu POS ({lepas.length})</h2>
          <p className="mb-2 text-xs text-stone-600">Nama di file HPP berbeda dengan menu POS, atau menunya belum ada. Pilih menu yang sesuai.</p>
          <ul className="divide-y divide-amber-200">
            {lepas.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <span className="min-w-0 flex-1 basis-48">
                  <b>{x.nama_hpp}</b> ({x.seri}) · HPP {formatRupiah(x.total_hpp)}
                </span>
                {bisaUbah && <PilihMenu id={x.id} value={null} opsi={opsi} />}
              </li>
            ))}
          </ul>
        </section>
      )}

      <DaftarHpp menus={menus} hpp={hpp.filter((x) => x.menu_id)} opsi={opsi} bisaUbah={bisaUbah} />
    </div>
  );
}
