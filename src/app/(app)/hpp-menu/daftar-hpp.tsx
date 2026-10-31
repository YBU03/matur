"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge, Kosong, isian } from "@/components/ui-halaman";
import { EditorResep } from "@/components/editor-resep";
import { formatRupiah } from "@/lib/format";
import { hppResep, marginPersen, nadaMargin, type BahanHpp, type BarisResep } from "@/lib/hpp-live";
import { PilihMenu } from "./pilih-menu";

type Komponen = { nama: string; qty: number | null; satuan: string | null; harga_unit: number | null; biaya: number | null };
export type Hpp = { id: string; menu_id: string | null; nama_hpp: string; seri: string; komponen: Komponen[]; total_hpp: number; harga_jual: number | null };
export type MenuHpp = {
  id: string;
  nama: string;
  harga_langsung: number;
  harga_ojol: number;
  titipan: boolean;
  harga_titip: number | null;
  aktif: boolean;
  induk_id: string | null;
  kemasan: string | null;
  kategori_menu: { nama: string; urutan: number } | null;
};

const SERI = ["Ice", "Hot", "Can"];
const angka = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 3 });

function Baris({ m, label, template, resep, peta, bisaUbah, onEdit }: { m: MenuHpp; label?: string; template?: boolean; resep: BarisResep[]; peta: Map<string, BahanHpp>; bisaUbah: boolean; onEdit: (m: MenuHpp) => void }) {
    const rows = resep.filter((r) => r.menu_id === m.id && !r.varian_id);
    const nilai = m.titipan ? Number(m.harga_titip ?? 0) : hppResep(rows, peta);
    const md = marginPersen(m.harga_langsung, nilai);
    const mo = marginPersen(m.harga_ojol, nilai);
    const adaVarian = resep.some((r) => r.menu_id === m.id && r.varian_id);
    return (
      <details className={`group rounded-xl border px-3 py-2 open:shadow-sm ${template ? "border-dashed border-stone-200 bg-white" : "border-stone-100 bg-stone-50/70 open:bg-white"} ${m.aktif ? "" : "opacity-60"}`}>
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          {label && <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${template ? "bg-stone-100 text-stone-600" : "bg-kopi-900 text-white"}`}>{label}</span>}
          {!m.aktif && <Badge>Nonaktif</Badge>}
          <span>
            HPP <b className="tabular-nums">{nilai ? formatRupiah(nilai) : "Rp 0"}</b>
          </span>
          {!template && (
            <span className="text-stone-500">
              jual {formatRupiah(m.harga_langsung)} · ojol {formatRupiah(m.harga_ojol)}
            </span>
          )}
          <span className="ml-auto flex flex-wrap items-center gap-1.5">
            {m.titipan ? (
              <Badge nada="biru">Titipan · HPP = harga titip</Badge>
            ) : !rows.length ? (
              <Badge nada="merah">Belum ada resep</Badge>
            ) : template ? (
              <Badge>Template kemasan baru</Badge>
            ) : (
              <>
                <Badge nada={nadaMargin(md)}>margin {md}%</Badge>
                <span className="text-[11px] text-stone-500">ojol {mo}%</span>
              </>
            )}
          </span>
          <span className="text-xs text-matur-700 group-open:hidden">rincian ▾</span>
          <span className="hidden text-xs text-matur-700 group-open:inline">tutup ▴</span>
        </summary>
        {!m.titipan && (
          <div className="mt-2 space-y-2">
            {rows.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-xs">
                  <thead className="bg-matur-50 text-left font-semibold uppercase tracking-wide text-matur-800">
                    <tr>
                      <th className="rounded-l-lg px-2 py-1.5">Bahan</th>
                      <th className="px-2 text-right">Takaran</th>
                      <th className="px-2 text-right">HPP/satuan</th>
                      <th className="rounded-r-lg px-2 text-right">Biaya</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => {
                      const b = peta.get(r.bahan_id);
                      return (
                        <tr key={i} className="border-t border-stone-100">
                          <td className="px-2 py-1.5">{b?.nama ?? "Bahan dihapus"}</td>
                          <td className="px-2 text-right tabular-nums">
                            {angka.format(Number(r.takaran))} {b?.satuan_pakai}
                          </td>
                          <td className="px-2 text-right tabular-nums">{b?.harga_pokok ? angka.format(Number(b.harga_pokok)) : "-"}</td>
                          <td className="px-2 text-right tabular-nums">{formatRupiah(Number(r.takaran) * Number(b?.harga_pokok ?? 0))}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {adaVarian && <p className="text-[11px] text-stone-500">+ Ada resep tambahan per pilihan (mis. Extra) yang ikut dihitung saat pilihan itu dijual.</p>}
            {bisaUbah && (
              <button type="button" onClick={() => onEdit(m)} className="rounded-lg bg-kopi-900 px-3 py-1.5 text-xs font-semibold text-white">
                🧾 {rows.length ? "Ubah resep" : "Buat resep"}
              </button>
            )}
          </div>
        )}
      </details>
    );
  }

// HPP Menu live: dihitung dari resep yang dipakai POS × harga bahan saat ini. Data file HPP lama hanya referensi.
export function DaftarHpp({ menus, hpp, resep, bahan, opsi, bisaUbah }: { menus: MenuHpp[]; hpp: Hpp[]; resep: BarisResep[]; bahan: BahanHpp[]; opsi: { id: string; nama: string }[]; bisaUbah: boolean }) {
  const [cari, setCari] = useState("");
  const [kat, setKat] = useState("");
  const [edit, setEdit] = useState<MenuHpp | null>(null);
  const peta = new Map(bahan.map((b) => [b.id, b]));
  const dasar = (id: string) => resep.filter((r) => r.menu_id === id && !r.varian_id);
  const induk = menus.filter((m) => !m.induk_id);
  const kategori = [...new Map(induk.filter((m) => m.kategori_menu).map((m) => [m.kategori_menu!.nama, m.kategori_menu!.urutan])).entries()].sort((a, b) => a[1] - b[1]).map(([k]) => k);
  const adaTanpaKategori = induk.some((m) => !m.kategori_menu);
  const kata = cari.trim().toLowerCase();
  const tampil = induk.filter((m) => (kat === "" || (kat === "-" ? !m.kategori_menu : m.kategori_menu?.nama === kat)) && (!kata || m.nama.toLowerCase().includes(kata)));
  const ctx = { resep, peta, bisaUbah, onEdit: setEdit };
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
          Menampilkan {tampil.length} dari {induk.length} menu · HPP dihitung dari resep POS × HPP bahan saat ini
        </p>
      </div>

      {tampil.length === 0 ? (
        <Kosong ikon="☕" judul="Menu tidak ditemukan.">
          Coba kata kunci atau kategori lain.
        </Kosong>
      ) : (
        <ul className="space-y-2">
          {tampil.map((menu) => {
            const anak = menus.filter((x) => x.induk_id === menu.id);
            const file = hpp.filter((x) => x.menu_id === menu.id).sort((a, b) => SERI.indexOf(a.seri) - SERI.indexOf(b.seri));
            return (
              <li key={menu.id} className="rounded-2xl border border-matur-100 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <p className="mr-auto font-bold text-kopi-900">{menu.nama}</p>
                  <span className="text-xs text-stone-500">
                    {menu.kategori_menu?.nama ?? "Tanpa kategori"}
                    {anak.length > 0 && ` · ${anak.length} kemasan`}
                  </span>
                  {bisaUbah && !menu.titipan && (
                    <Link href={`/menu-varian/${menu.id}`} className="text-xs font-semibold text-matur-700 hover:underline">
                      🧋 Varian & Kemasan
                    </Link>
                  )}
                </div>
                <div className="mt-2 space-y-2">
                  {anak.length ? (
                    <>
                      {anak.map((k) => (
                        <Baris key={k.id} m={k} label={k.kemasan ?? ""} {...ctx} />
                      ))}
                      <Baris m={menu} label="Resep dasar" template {...ctx} />
                    </>
                  ) : (
                    <Baris m={menu} {...ctx} />
                  )}
                </div>
                {file.length > 0 && (
                  <details className="mt-2 text-xs">
                    <summary className="cursor-pointer text-stone-500">
                      📄 Referensi file HPP: {file.map((x) => `${x.seri} ${formatRupiah(x.total_hpp)}`).join(" · ")}
                    </summary>
                    <div className="mt-2 space-y-2 rounded-xl bg-stone-50 p-3">
                      <p className="text-stone-500">Angka dari file HPP RUMA (harga bahan saat itu). Tidak dipakai POS; HPP di atas yang berlaku.</p>
                      {file.map((x) => (
                        <div key={x.id} className="border-t border-stone-200 pt-2 first:border-0 first:pt-0">
                          <p className="font-semibold text-kopi-900">
                            {x.seri} · {formatRupiah(x.total_hpp)}
                            {x.harga_jual ? ` · jual file ${formatRupiah(x.harga_jual)}` : ""}
                          </p>
                          <p className="text-stone-600">{x.komponen.map((k) => `${k.nama}${k.qty === null ? "" : ` ${angka.format(k.qty)}${k.satuan ? " " + k.satuan : ""}`}`).join(", ")}</p>
                          {bisaUbah && (
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-stone-500">
                              Terhubung ke: <PilihMenu id={x.id} value={x.menu_id} opsi={opsi} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {edit && (
        <EditorResep
          key={edit.id}
          menu={edit}
          awal={dasar(edit.id).map((r) => ({ bahan_id: r.bahan_id, takaran: Number(r.takaran) }))}
          bahan={bahan}
          onTutup={() => setEdit(null)}
        />
      )}
    </section>
  );
}
