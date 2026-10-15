import { notFound } from "next/navigation";
import { formatRupiah } from "@/lib/format";
import { getSession } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { TambahHpp } from "./tambah-hpp";
import { PilihMenu } from "./pilih-menu";

type Komponen = { nama: string; qty: number | null; satuan: string | null; harga_unit: number | null; biaya: number | null };
type Hpp = { id: string; menu_id: string | null; nama_hpp: string; seri: string; komponen: Komponen[]; total_hpp: number; harga_jual: number | null };
const SERI = ["Ice", "Hot", "Can"];
const angka = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });

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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">HPP Menu</h1>
        <p className="text-sm text-stone-500">Biaya bahan per menu dan margin harga jual POS. Tambahkan HPP beserta resep untuk menu baru.</p>
      </div>

      {bisaUbah && <TambahHpp menus={menus.filter((m) => !(resep ?? []).some((r) => r.menu_id === m.id) && !hpp.some((h) => h.menu_id === m.id))} bahan={bahan ?? []} kategori={kategori ?? []} />}
      {lepas.length > 0 && (
        <section className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4">
          <h2 className="font-bold">HPP belum terhubung ke menu POS ({lepas.length})</h2>
          <p className="mb-2 text-xs text-stone-600">Nama di file HPP berbeda dengan menu POS, atau menunya belum ada. Pilih menu yang sesuai.</p>
          <ul className="divide-y">
            {lepas.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <span className="min-w-40 flex-1">
                  <b>{x.nama_hpp}</b> ({x.seri}) · HPP {formatRupiah(x.total_hpp)}
                </span>
                {bisaUbah && <PilihMenu id={x.id} value={null} opsi={opsi} />}
              </li>
            ))}
          </ul>
        </section>
      )}

      <ul className="space-y-2">
        {menus.map((menu) => {
          const rows = hpp.filter((x) => x.menu_id === menu.id).sort((a, b) => SERI.indexOf(a.seri) - SERI.indexOf(b.seri));
          return (
            <li key={menu.id} className="rounded-2xl border border-matur-200 bg-white p-4">
              <div className="flex flex-wrap items-baseline gap-2">
                <p className="mr-auto font-bold">{menu.nama}</p>
                <span className="text-xs text-stone-500">{menu.kategori_menu?.nama} · harga POS {formatRupiah(menu.harga_langsung)}</span>
              </div>
              {rows.length === 0 ? (
                <p className="mt-1 text-sm text-stone-400">Belum ada data HPP.</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {rows.map((x) => {
                    const jual = x.harga_jual ?? menu.harga_langsung;
                    const margin = jual ? Math.round(((jual - x.total_hpp) / jual) * 100) : 0;
                    return (
                      <details key={x.id} className="rounded-xl bg-stone-50 px-3 py-2">
                        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                          <span className="rounded-md bg-kopi-900 px-2 py-0.5 text-xs font-semibold text-white">{x.seri}</span>
                          <span>
                            HPP <b>{formatRupiah(x.total_hpp)}</b>
                          </span>
                          <span className="text-stone-500">jual {formatRupiah(jual)}</span>
                          <span className={`ml-auto font-bold ${margin >= 60 ? "text-green-700" : margin >= 45 ? "text-amber-700" : "text-red-600"}`}>margin {margin}%</span>
                          <span className="text-xs text-matur-700">rincian ▾</span>
                        </summary>
                        <table className="mt-2 w-full text-xs">
                          <thead className="text-left text-stone-500">
                            <tr>
                              <th className="py-1">Komponen</th>
                              <th className="text-right">Takaran</th>
                              <th className="text-right">Harga/unit</th>
                              <th className="text-right">Biaya</th>
                            </tr>
                          </thead>
                          <tbody>
                            {x.komponen.map((k, i) => (
                              <tr key={i} className="border-t">
                                <td className="py-1">{k.nama}</td>
                                <td className="text-right">{k.qty === null ? "-" : `${angka.format(k.qty)} ${k.satuan ?? ""}`}</td>
                                <td className="text-right">{k.harga_unit === null ? "-" : angka.format(k.harga_unit)}</td>
                                <td className="text-right tabular-nums">{formatRupiah(k.biaya ?? 0)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {bisaUbah && (
                          <div className="mt-2 flex items-center gap-2 text-xs text-stone-500">
                            Terhubung ke: <PilihMenu id={x.id} value={x.menu_id} opsi={opsi} />
                          </div>
                        )}
                      </details>
                    );
                  })}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
