"use client";
import { useState } from "react";
import { formatRupiah } from "@/lib/format";
import { labelPenyajian, saringMenuPromo, type MenuPromo, type FilterMenuPromo } from "@/lib/promo-menu";

export function PromoMenuFilter({ menus, kategori, terpilih, onTambah }: {
  menus: MenuPromo[];
  kategori: { id: string; nama: string }[];
  terpilih: string[];
  onTambah: (ids: string[]) => void;
}) {
  const [f, setF] = useState<FilterMenuPromo>({ kategori: "", penyajian: "", kemasan: "", cari: "" });
  const hasil = saringMenuPromo(menus, f);
  const selected = new Set(terpilih);
  const tambahan = hasil.filter((m) => !selected.has(m.id));
  const kemasan = [...new Set(menus.map((m) => m.jenis_kemasan).filter((x): x is string => !!x))].sort();
  const cls = "mt-1 w-full rounded-lg border border-matur-200 bg-white p-2 text-sm";
  const aktif = !!(f.kategori || f.penyajian || f.kemasan || f.cari.trim());
  return <div className="space-y-3 rounded-xl border border-matur-200 bg-white p-3">
    <p className="text-sm font-bold">Pilih kelompok menu</p>
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="text-xs font-medium">Kategori produk<select aria-label="Kategori produk" className={cls} value={f.kategori} onChange={(e) => setF({ ...f, kategori: e.target.value })}><option value="">Semua kategori</option>{kategori.map((k) => <option key={k.id} value={k.id}>{k.nama}</option>)}</select></label>
      <label className="text-xs font-medium">Penyajian<select aria-label="Penyajian" className={cls} value={f.penyajian} onChange={(e) => setF({ ...f, penyajian: e.target.value })}><option value="">Semua penyajian</option><option value="ice">Ice / dingin</option><option value="hot">Hot / panas</option><option value="tanpa">Tanpa pilihan suhu</option><option value="kosong">Belum ditentukan</option></select></label>
      <label className="text-xs font-medium">Jenis kemasan<select aria-label="Jenis kemasan" className={cls} value={f.kemasan} onChange={(e) => setF({ ...f, kemasan: e.target.value })}><option value="">Semua kemasan</option>{kemasan.map((k) => <option key={k} value={k}>{k}</option>)}<option value="kosong">Belum ditentukan</option></select></label>
      <label className="text-xs font-medium">Cari menu<input aria-label="Cari menu" className={cls} value={f.cari} placeholder="Ketik nama menu…" onChange={(e) => setF({ ...f, cari: e.target.value })} /></label>
    </div>
    <p role="status" className="text-xs text-stone-600">{hasil.length} menu sesuai filter · {tambahan.length} belum dipilih</p>
    {aktif && <ul aria-label="Pratinjau menu sesuai filter" className="max-h-52 divide-y overflow-y-auto rounded-lg border border-matur-100">
      {hasil.map((m) => <li key={m.id} className="flex items-start justify-between gap-2 p-2 text-xs"><div><strong>{m.nama}</strong><p className="mt-0.5 text-stone-500">{labelPenyajian(m.penyajian)} · {m.jenis_kemasan ?? "Kemasan belum ditentukan"} · {formatRupiah(m.harga_langsung ?? 0)}</p></div>{selected.has(m.id) && <span className="shrink-0 text-emerald-700">Sudah dipilih</span>}</li>)}
      {!hasil.length && <li className="p-3 text-xs text-stone-500">Tidak ada menu sesuai filter. Coba ubah kategori, penyajian, atau kemasan.</li>}
    </ul>}
    <button type="button" disabled={!aktif || !tambahan.length} onClick={() => onTambah(tambahan.map((m) => m.id))} className="rounded-lg bg-matur-500 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">+ Tambahkan {tambahan.length} menu sesuai filter</button>
    <p className="text-[11px] text-stone-500">Periksa daftar sebelum menambahkan. Filter tidak menghapus pilihan yang sudah ada. Menu baru tidak otomatis ikut promo; aturan dan aktivasi tetap disimpan melalui tombol Simpan.</p>
  </div>;
}
