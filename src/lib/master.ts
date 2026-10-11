// Konfigurasi data master (MST-01..08). Satu mesin CRUD dipakai semua entitas:
// daftar, tambah/ubah dengan konfirmasi (AKS-05), hapus 2 tahap + tempat sampah (AKS-06/07).
// Hak tulis sesungguhnya ditegakkan RLS di database; `editors` hanya untuk tampilan.

import type { Role } from "./roles";

export type FieldType = "text" | "number" | "money" | "percent" | "date" | "bool" | "select" | "enum";

export type Field = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  /** untuk select: tabel rujukan dan kolom labelnya */
  ref?: { table: string; label: string };
  options?: string[];
  /** tampil di tabel daftar (default true) */
  list?: boolean;
};

export type Entity = {
  table: string;
  title: string;
  /** kolom yang diketik ulang saat hapus 2 tahap */
  nameKey: string;
  editors: Role[];
  fields: Field[];
};

export const ENTITIES: Record<string, Entity> = {
  outlet: {
    table: "outlet",
    title: "Outlet",
    nameKey: "nama",
    editors: ["owner", "admin_pusat"],
    fields: [
      { key: "nama", label: "Nama Outlet", type: "text", required: true },
      { key: "kota", label: "Kota", type: "text" },
      { key: "alamat", label: "Alamat", type: "text", list: false },
      { key: "tgl_mulai", label: "Mulai Operasional", type: "date" },
      { key: "jam_operasional", label: "Jam Operasional", type: "text" },
      { key: "status", label: "Status", type: "enum", options: ["pembangunan", "operasional", "tutup"], required: true },
      { key: "spv_id", label: "SPV", type: "select", ref: { table: "pengguna", label: "nama" } },
      { key: "pj_laporan_id", label: "PJ Laporan", type: "select", ref: { table: "pengguna", label: "nama" }, list: false },
    ],
  },
  mitra: {
    table: "mitra",
    title: "Mitra",
    nameKey: "nama",
    editors: ["owner", "admin_pusat"],
    fields: [
      { key: "nama", label: "Nama Mitra", type: "text", required: true },
      { key: "no_hp", label: "No. HP", type: "text" },
      { key: "email", label: "Email", type: "text" },
    ],
  },
  perjanjian: {
    table: "perjanjian",
    title: "Perjanjian Mitra",
    nameKey: "outlet_id",
    editors: ["owner", "admin_pusat", "finance"],
    fields: [
      { key: "mitra_id", label: "Mitra", type: "select", ref: { table: "mitra", label: "nama" }, required: true },
      { key: "outlet_id", label: "Outlet", type: "select", ref: { table: "outlet", label: "nama" }, required: true },
      { key: "persen_mitra", label: "Bagi Hasil Mitra %", type: "percent", required: true },
      { key: "persen_pengelola", label: "Bagi Hasil Pengelola %", type: "percent", required: true },
      { key: "sewa_bulanan", label: "Sewa Bulanan", type: "money" },
      { key: "modal_outlet", label: "Modal Outlet (Kas Kecil)", type: "money" },
      { key: "investasi_awal", label: "Investasi Awal", type: "money", required: true },
      { key: "sewa_masuk_bep", label: "Sewa dihitung BEP", type: "bool", list: false },
      { key: "bank", label: "Bank", type: "text", list: false },
      { key: "no_rekening", label: "No. Rekening", type: "text", list: false },
      { key: "atas_nama", label: "Atas Nama", type: "text", list: false },
    ],
  },
  kategori_menu: {
    table: "kategori_menu",
    title: "Kategori Menu",
    nameKey: "nama",
    editors: ["owner", "admin_pusat"],
    fields: [
      { key: "nama", label: "Nama Kategori", type: "text", required: true },
      { key: "urutan", label: "Urutan", type: "number" },
    ],
  },
  menu: {
    table: "menu",
    title: "Menu",
    nameKey: "nama",
    editors: ["owner", "admin_pusat"],
    fields: [
      { key: "nama", label: "Nama Menu", type: "text", required: true },
      { key: "kategori_id", label: "Kategori", type: "select", ref: { table: "kategori_menu", label: "nama" } },
      { key: "harga_langsung", label: "Harga Dine-in/Take Away", type: "money", required: true },
      { key: "harga_ojol", label: "Harga Ojol", type: "money", required: true },
      { key: "aktif", label: "Aktif", type: "bool" },
    ],
  },
  varian: {
    table: "varian",
    title: "Varian Menu",
    nameKey: "nama",
    editors: ["owner", "admin_pusat"],
    fields: [
      { key: "menu_id", label: "Menu", type: "select", ref: { table: "menu", label: "nama" }, required: true },
      { key: "grup", label: "Grup", type: "enum", options: ["Ukuran", "Suhu", "Gula", "Extra"], required: true },
      { key: "nama", label: "Nama Varian", type: "text", required: true },
      { key: "tambahan_harga", label: "Tambahan Harga", type: "money" },
    ],
  },
  bahan: {
    table: "bahan",
    title: "Bahan Baku",
    nameKey: "nama",
    editors: ["owner", "admin_pusat", "admin_gudang"],
    fields: [
      { key: "nama", label: "Nama Bahan", type: "text", required: true },
      { key: "satuan_beli", label: "Satuan Beli", type: "text", required: true },
      { key: "satuan_pakai", label: "Satuan Pakai", type: "text", required: true },
      { key: "konversi", label: "Isi per Satuan Beli", type: "number", required: true },
      { key: "stok_min", label: "Stok Minimum", type: "number" },
      { key: "harga_pokok", label: "Harga Pokok / Satuan Pakai", type: "money" },
      { key: "supplier_id", label: "Supplier", type: "select", ref: { table: "supplier", label: "nama" } },
    ],
  },
  resep: {
    table: "resep",
    title: "Resep",
    nameKey: "menu_id",
    editors: ["owner", "admin_pusat"],
    fields: [
      { key: "menu_id", label: "Menu", type: "select", ref: { table: "menu", label: "nama" }, required: true },
      { key: "varian_id", label: "Varian (kosong = semua)", type: "select", ref: { table: "varian", label: "nama" } },
      { key: "bahan_id", label: "Bahan", type: "select", ref: { table: "bahan", label: "nama" }, required: true },
      { key: "takaran", label: "Takaran (satuan pakai)", type: "number", required: true },
    ],
  },
  supplier: {
    table: "supplier",
    title: "Supplier",
    nameKey: "nama",
    editors: ["owner", "admin_pusat", "admin_gudang"],
    fields: [
      { key: "nama", label: "Nama Supplier", type: "text", required: true },
      { key: "kontak", label: "Kontak", type: "text" },
      { key: "alamat", label: "Alamat", type: "text" },
    ],
  },
  karyawan: {
    table: "karyawan",
    title: "Karyawan",
    nameKey: "nama",
    editors: ["owner", "hrd"],
    fields: [
      { key: "nama", label: "Nama", type: "text", required: true },
      { key: "outlet_id", label: "Outlet Utama", type: "select", ref: { table: "outlet", label: "nama" } },
      { key: "jabatan", label: "Jabatan", type: "text", required: true },
      { key: "is_spv", label: "SPV", type: "bool" },
      { key: "tgl_masuk", label: "Tanggal Masuk", type: "date" },
      { key: "status", label: "Status", type: "enum", options: ["aktif", "nonaktif"], required: true },
    ],
  },
};

/** Ubah isian form menjadi nilai kolom; hanya kolom yang terdaftar yang lolos. */
export function parseForm(entity: Entity, form: Record<string, string | boolean>) {
  const out: Record<string, string | number | boolean | null> = {};
  const errors: string[] = [];
  for (const f of entity.fields) {
    const raw = form[f.key];
    if (f.type === "bool") {
      out[f.key] = raw === true || raw === "true";
      continue;
    }
    const v = typeof raw === "string" ? raw.trim() : "";
    if (!v) {
      if (f.required) errors.push(`${f.label} wajib diisi`);
      out[f.key] = null;
      continue;
    }
    if (f.type === "money" || f.type === "number" || f.type === "percent") {
      const n = Number(f.type === "money" ? v.replace(/[^\d-]/g, "") : v.replace(",", "."));
      if (!Number.isFinite(n)) errors.push(`${f.label} harus angka`);
      // uang selalu rupiah bulat
      out[f.key] = f.type === "money" ? Math.round(n) : n;
    } else if (f.type === "enum" && f.options && !f.options.includes(v)) {
      errors.push(`${f.label} tidak valid`);
    } else {
      out[f.key] = v;
    }
  }
  return { values: out, errors };
}
