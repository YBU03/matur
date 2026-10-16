"use client";

import { useState } from "react";
import { Badge, Kosong, isian } from "@/components/ui-halaman";
import { formatRupiah } from "@/lib/format";
import { PilihMenu } from "./pilih-menu";

type Komponen = { nama: string; qty: number | null; satuan: string | null; harga_unit: number | null; biaya: number | null };
export type Hpp = { id: string; menu_id: string | null; nama_hpp: string; seri: string; komponen: Komponen[]; total_hpp: number; harga_jual: number | null };
type Menu = { id: string; nama: string; harga_langsung: number; kategori_menu: { nama: string; urutan: number } | null };

const SERI = ["Ice", "Hot", "Can"];
const angka = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });
const nadaMargin = (m: number) => (m >= 60 ? "hijau" : m >= 45 ? "kuning" : "merah");

// Daftar HPP per menu dengan pencarian & filter kategori (di browser, atas data yang sudah dimuat)
export function DaftarHpp({ menus, hpp, opsi, bisaUbah }: { menus: Menu[]; hpp: Hpp[]; opsi: { id: string; nama: string }[]; bisaUbah: boolean }) {
  const [cari, setCari] = useState("");
  const [kat, setKat] = useState("");
  const kategori = [...new Map(menus.filter((m) => m.kategori_menu).map((m) => [m.kategori_menu!.nama, m.kategori_menu!.urutan])).entries()].sort((a, b) => a[1] - b[1]).map(([k]) => k);
  const adaTanpaKategori = menus.some((m) => !m.kategori_menu);
  const kata = cari.trim().toLowerCase();
  const tampil = menus.filter((m) => (kat === "" || (kat === "-" ? !m.kategori_menu : m.kategori_menu?.nama === kat)) && (!kata || m.nama.toLowerCase().includes(kata)));
  const chip = (aktif: boolean) => `whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold ${aktif ? "bg-kopi-900 text-white shadow-sm" : "border border-matur-200 bg-white text-kopi-700 hover:bg-matur-50"}`;

  return (
    <section className="space-y-3">
      <div className="space-y-2">
        <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="🔍 Cari menu…" className={`${isian} w-full`} />
        {kategori.length > 0 && (
          <div className="-mx-4 overflow-x-auto px-4">
            <div className="flex w-max gap-1.5">
              <button onClick={() => setKat("")} className={chip(kat === "")}>
                Semua
              </button>
              {kategori.map((k) => (
                <button key={k} onClick={() => setKat(k)} className={chip(kat === k)}>
                  {k}
                </button>
              ))}
              {adaTanpaKategori && (
                <button onClick={() => setKat("-")} className={chip(kat === "-")}>
                  Tanpa kategori
                </button>
              )}
            </div>
          </div>
        )}
        <p className="text-xs text-stone-500">
          Menampilkan {tampil.length} dari {menus.length} menu
        </p>
      </div>

      {tampil.length === 0 ? (
        <Kosong ikon="☕" judul="Menu tidak ditemukan.">
          Coba kata kunci atau kategori lain.
        </Kosong>
      ) : (
        <ul className="space-y-2">
          {tampil.map((menu) => {
            const rows = hpp.filter((x) => x.menu_id === menu.id).sort((a, b) => SERI.indexOf(a.seri) - SERI.indexOf(b.seri));
            return (
              <li key={menu.id} className="rounded-2xl border border-matur-100 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <p className="mr-auto font-bold text-kopi-900">{menu.nama}</p>
                  <span className="text-xs text-stone-500">
                    {menu.kategori_menu?.nama ?? "Tanpa kategori"} · harga POS <b className="text-stone-700">{formatRupiah(menu.harga_langsung)}</b>
                  </span>
                </div>
                {rows.length === 0 ? (
                  <p className="mt-2 flex items-center gap-2 text-sm text-stone-400">
                    <Badge>Belum ada data HPP</Badge>
                  </p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {rows.map((x) => {
                      const jual = x.harga_jual ?? menu.harga_langsung;
                      const margin = jual ? Math.round(((jual - x.total_hpp) / jual) * 100) : 0;
                      return (
                        <details key={x.id} className="group rounded-xl border border-stone-100 bg-stone-50/70 px-3 py-2 open:bg-white open:shadow-sm">
                          <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                            <span className="rounded-full bg-kopi-900 px-2.5 py-0.5 text-xs font-semibold text-white">{x.seri}</span>
                            <span>
                              HPP <b className="tabular-nums">{formatRupiah(x.total_hpp)}</b>
                            </span>
                            <span className="text-stone-500">jual {formatRupiah(jual)}</span>
                            <span className="ml-auto">
                              <Badge nada={nadaMargin(margin)}>margin {margin}%</Badge>
                            </span>
                            <span className="text-xs text-matur-700 group-open:hidden">rincian ▾</span>
                            <span className="hidden text-xs text-matur-700 group-open:inline">tutup ▴</span>
                          </summary>
                          <div className="mt-2 overflow-x-auto">
                            <table className="w-full min-w-[420px] text-xs">
                              <thead className="bg-matur-50 text-left font-semibold uppercase tracking-wide text-matur-800">
                                <tr>
                                  <th className="rounded-l-lg px-2 py-1.5">Komponen</th>
                                  <th className="px-2 text-right">Takaran</th>
                                  <th className="px-2 text-right">Harga/unit</th>
                                  <th className="rounded-r-lg px-2 text-right">Biaya</th>
                                </tr>
                              </thead>
                              <tbody>
                                {x.komponen.map((k, i) => (
                                  <tr key={i} className="border-t border-stone-100">
                                    <td className="px-2 py-1.5">{k.nama}</td>
                                    <td className="px-2 text-right tabular-nums">{k.qty === null ? "-" : `${angka.format(k.qty)} ${k.satuan ?? ""}`}</td>
                                    <td className="px-2 text-right tabular-nums">{k.harga_unit === null ? "-" : angka.format(k.harga_unit)}</td>
                                    <td className="px-2 text-right tabular-nums">{formatRupiah(k.biaya ?? 0)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {bisaUbah && (
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-stone-500">
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
      )}
    </section>
  );
}
