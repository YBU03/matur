import { notFound } from "next/navigation";
import { BarisAngka, ChipHeader, HeaderHalaman, KartuAngka } from "@/components/ui-halaman";
import { formatRupiah } from "@/lib/format";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { TambahHpp } from "./tambah-hpp";
import { PilihMenu } from "./pilih-menu";
import { DaftarHpp, type Hpp, type MenuHpp } from "./daftar-hpp";
import { hppResep, marginPersen, type BahanHpp, type BarisResep } from "@/lib/hpp-live";


// HPP per menu: dihitung live dari resep POS × HPP bahan; data file HPP RUMA tetap sebagai referensi
export default async function HppMenu() {
  const s = await getSession();
  if (!s?.active || !["owner", "admin_pusat", "admin_gudang", "finance"].includes(s.active.role)) notFound();
  const bisaUbah = s.active.role !== "finance";
  const supabase = await supabaseServer();
  const [{ data: h }, { data: m }, { data: bahan }, { data: kategori }, { data: resep }] = await Promise.all([
    supabase.from("hpp_menu").select("id, menu_id, nama_hpp, seri, komponen, total_hpp, harga_jual").is("deleted_at", null),
    supabase.from("menu").select("id, nama, harga_langsung, harga_ojol, titipan, harga_titip, aktif, induk_id, kemasan, kategori_menu(nama, urutan), urutan").eq("mode", "asli").is("deleted_at", null).order("urutan").order("nama"),
    supabase.from("bahan").select("id, nama, satuan_pakai, harga_pokok").eq("mode", "asli").is("deleted_at", null).order("nama"),
    supabase.from("kategori_menu").select("id, nama").is("deleted_at", null).order("nama"),
    supabase.from("resep").select("menu_id, varian_id, bahan_id, takaran").eq("mode", "asli").is("deleted_at", null),
  ]);
  const hpp = (h ?? []) as Hpp[];
  const menus = (m ?? []) as unknown as MenuHpp[];
  const rs = ((resep ?? []) as BarisResep[]).map((r) => ({ ...r, takaran: Number(r.takaran) }));
  const bh = (bahan ?? []) as BahanHpp[];
  const lepas = hpp.filter((x) => !x.menu_id);
  const opsi = menus.filter((x) => !x.induk_id).map((x) => ({ id: x.id, nama: x.nama }));

  // ringkasan live atas item yang benar-benar dijual: kemasan, atau menu tanpa kemasan
  const peta = new Map(bh.map((b) => [b.id, b]));
  const dijual = menus.filter((x) => x.aktif && !menus.some((k) => k.induk_id === x.id && k.aktif));
  const punyaResep = (id: string) => rs.some((r) => r.menu_id === id && !r.varian_id);
  const margins = dijual
    .filter((x) => x.titipan || punyaResep(x.id))
    .map((x) => marginPersen(x.harga_langsung, x.titipan ? Number(x.harga_titip ?? 0) : hppResep(rs.filter((r) => r.menu_id === x.id && !r.varian_id), peta)));
  const rataMargin = margins.length ? Math.round(margins.reduce((t, n) => t + n, 0) / margins.length) : null;
  const marginRendah = margins.filter((n) => n < 45).length;
  const tanpaResep = dijual.filter((x) => !x.titipan && !punyaResep(x.id)).length;

  return (
    <div className="space-y-4">
      <HeaderHalaman judul="HPP Menu" ikon="☕" keterangan="HPP live dari resep yang dipakai POS × HPP bahan terbaru (ikut pembelian Gudang), beserta harga jual dan margin. Ubah resep langsung di sini.">
        <ChipHeader>{hpp.length} data HPP</ChipHeader>
        {lepas.length > 0 && <ChipHeader>⚠️ {lepas.length} belum terhubung</ChipHeader>}
      </HeaderHalaman>

      <BarisAngka>
        <KartuAngka label="Item dijual" nilai={dijual.length} ikon="☕" sub="menu & kemasan aktif" />
        <KartuAngka label="Rata-rata margin" nilai={rataMargin === null ? "–" : `${rataMargin}%`} ikon="📈" nada={rataMargin === null ? "netral" : rataMargin >= 60 ? "hijau" : rataMargin >= 45 ? "kuning" : "merah"} sub={`dari ${margins.length} item (harga dine-in)`} />
        <KartuAngka label="Margin < 45%" nilai={marginRendah} ikon="⚠️" nada="merah" sub="perlu ditinjau" />
        <KartuAngka label="Belum ada resep" nilai={tanpaResep} ikon="❔" nada="kuning" sub="stok tidak terpotong, HPP Rp 0" />
      </BarisAngka>

      {bisaUbah && <TambahHpp menus={menus.filter((m) => !m.induk_id && !m.titipan && !rs.some((r) => r.menu_id === m.id) && !hpp.some((h) => h.menu_id === m.id))} bahan={bahan ?? []} kategori={kategori ?? []} />}
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

      <DaftarHpp menus={menus} hpp={hpp.filter((x) => x.menu_id)} resep={rs} bahan={bh} opsi={opsi} bisaUbah={bisaUbah} />
    </div>
  );
}
