// Konfigurasi data master (MST-01..08). Satu mesin CRUD dipakai semua entitas:
// daftar, tambah/ubah dengan konfirmasi (AKS-05), hapus 2 tahap + tempat sampah (AKS-06/07).
// Hak tulis sesungguhnya ditegakkan RLS di database; `editors` hanya untuk tampilan.

import type { Role } from "./roles";

export const KATEGORI_BAHAN = ["Kopi & Susu", "Sirup & Saus", "Bubuk", "Buah & Jus", "Kemasan & Cup", "Lainnya"];

export type FieldType = "text" | "number" | "money" | "percent" | "date" | "bool" | "select" | "enum" | "image";

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
    editors: ["owner", "admin_pusat", "admin_gudang"],
    fields: [
      { key: "nama", label: "Nama Kategori", type: "text", required: true },
      { key: "urutan", label: "Urutan", type: "number" },
    ],
  },
  menu: {
    table: "menu",
    title: "Menu",
    nameKey: "nama",
    editors: ["owner", "admin_pusat", "admin_gudang"],
    fields: [
      { key: "foto_url", label: "Foto", type: "image" },
      { key: "nama", label: "Nama Menu", type: "text", required: true },
      { key: "kategori_id", label: "Kategori", type: "select", ref: { table: "kategori_menu", label: "nama" } },
      { key: "harga_langsung", label: "Harga Dine-in/Take Away", type: "money", required: true },
      { key: "harga_ojol", label: "Harga Ojol", type: "money", required: true },
      { key: "aktif", label: "Aktif", type: "bool" },
      { key: "urutan", label: "Urutan di POS", type: "number", list: false },
    ],
  },
  varian: {
    table: "varian",
    title: "Varian Menu",
    nameKey: "nama",
    editors: ["owner", "admin_pusat", "admin_gudang"],
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
      { key: "kategori", label: "Kategori", type: "enum", options: KATEGORI_BAHAN, required: true },
      { key: "satuan_beli", label: "Satuan Beli", type: "text", required: true },
      { key: "kemasan", label: "Keterangan Kemasan", type: "text" },
      { key: "satuan_pakai", label: "Satuan Pakai", type: "text", required: true },
      { key: "konversi", label: "Isi per Satuan Beli", type: "number", required: true },
      { key: "harga_beli", label: "Harga Beli / Satuan Beli", type: "money", required: true },
      { key: "harga_jual_gudang", label: "Harga Jual Gudang (per kemasan)", type: "money" },
      { key: "harga_pokok", label: "HPP / Satuan Pakai (kosong = otomatis)", type: "number", list: false },
      { key: "stok_min", label: "Stok Minimum (satuan pakai)", type: "number", list: false },
      { key: "supplier_id", label: "Supplier", type: "select", ref: { table: "supplier", label: "nama" }, list: false },
      { key: "catatan", label: "Catatan", type: "text", list: false },
      { key: "urutan", label: "Urutan", type: "number", list: false },
    ],
  },
  resep: {
    table: "resep",
    title: "Resep",
    nameKey: "menu_id",
    editors: ["owner", "admin_pusat", "admin_gudang"],
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
  proyek: {
    table: "proyek",
    title: "Proyek Pembangunan",
    nameKey: "nama",
    editors: ["owner", "admin_pusat"],
    fields: [
      { key: "nama", label: "Nama Proyek", type: "text", required: true },
      { key: "outlet_id", label: "Outlet", type: "select", ref: { table: "outlet", label: "nama" }, required: true },
      { key: "estimasi_budget", label: "Estimasi Biaya", type: "money", required: true },
      { key: "tgl_mulai", label: "Tanggal Mulai", type: "date" },
      { key: "tgl_soft_opening", label: "Soft Opening", type: "date" },
      { key: "target_buka", label: "Grand Opening", type: "date" },
      { key: "status", label: "Status", type: "enum", options: ["berjalan", "selesai"], required: true },
      { key: "alamat", label: "Alamat Lokasi", type: "text", list: false },
      { key: "maps_url", label: "Link Google Maps", type: "text", list: false },
      { key: "luas", label: "Luas Tempat", type: "text", list: false },
      { key: "sewa_tempat", label: "Sewa Tempat", type: "text", list: false },
      { key: "kontak_tempat", label: "Kontak Pemilik Tempat", type: "text", list: false },
      { key: "catatan", label: "Catatan", type: "text", list: false },
    ],
  },
  item_rab: {
    table: "item_rab",
    title: "Rincian Keperluan",
    nameKey: "nama",
    editors: ["owner", "admin_pusat"],
    fields: [
      { key: "proyek_id", label: "Proyek", type: "select", ref: { table: "proyek", label: "nama" }, required: true, list: false },
      { key: "kategori", label: "Kelompok", type: "text", required: true },
      { key: "bagian", label: "Bagian", type: "text" },
      { key: "nama", label: "Nama Barang", type: "text", required: true },
      { key: "spesifikasi", label: "Ukuran / Spesifikasi", type: "text" },
      { key: "qty", label: "Jumlah", type: "number", required: true },
      { key: "satuan", label: "Satuan", type: "text" },
      { key: "harga_satuan", label: "Harga Satuan", type: "money" },
      { key: "harga_estimasi", label: "Total Estimasi (kosong = jumlah × harga satuan)", type: "money" },
      { key: "harga_realisasi", label: "Total Realisasi", type: "money" },
      { key: "status", label: "Status", type: "enum", options: ["rencana", "dibeli", "terpasang"], required: true },
      { key: "dibeli_oleh", label: "Dibeli oleh", type: "enum", options: ["kantor", "mitra"], required: true },
      { key: "keterangan", label: "Keterangan", type: "text", list: false },
    ],
  },
  pekerjaan: {
    table: "pekerjaan",
    title: "Tahapan / Pekerjaan",
    nameKey: "nama",
    editors: ["owner", "admin_pusat"],
    fields: [
      { key: "proyek_id", label: "Proyek", type: "select", ref: { table: "proyek", label: "nama" }, required: true },
      { key: "nama", label: "Nama Pekerjaan", type: "text", required: true },
      { key: "pic_id", label: "PIC", type: "select", ref: { table: "pengguna", label: "nama" } },
      { key: "bobot", label: "Bobot", type: "number", required: true },
      { key: "progres", label: "Progres %", type: "percent", required: true },
      { key: "tgl_mulai", label: "Mulai", type: "date" },
      { key: "tgl_selesai", label: "Target Selesai", type: "date" },
      { key: "urutan", label: "Urutan", type: "number" },
    ],
  },
  jadwal_proyek: {
    table: "jadwal_proyek",
    title: "Jadwal",
    nameKey: "judul",
    editors: ["owner", "admin_pusat"],
    fields: [
      { key: "proyek_id", label: "Proyek", type: "select", ref: { table: "proyek", label: "nama" }, required: true, list: false },
      { key: "judul", label: "Kegiatan", type: "text", required: true },
      { key: "tgl_rencana", label: "Tanggal Rencana", type: "date" },
      { key: "tgl_realisasi", label: "Tanggal Realisasi", type: "date" },
      { key: "status", label: "Status", type: "enum", options: ["rencana", "selesai", "mundur"], required: true },
      { key: "keterangan", label: "Keterangan", type: "text" },
      { key: "urutan", label: "Urutan", type: "number", list: false },
    ],
  },
  setoran_mitra: {
    table: "setoran_mitra",
    title: "Setoran Dana Mitra",
    nameKey: "tanggal",
    editors: ["owner", "admin_pusat"],
    fields: [
      { key: "proyek_id", label: "Proyek", type: "select", ref: { table: "proyek", label: "nama" }, required: true, list: false },
      { key: "tanggal", label: "Tanggal", type: "date", required: true },
      { key: "jumlah", label: "Jumlah", type: "money", required: true },
      { key: "keterangan", label: "Keterangan (mis. termin 1, transfer BCA)", type: "text" },
    ],
  },
  checklist_proyek: {
    table: "checklist_proyek",
    title: "Checklist Persiapan Buka",
    nameKey: "nama",
    editors: ["owner", "admin_pusat"],
    fields: [
      { key: "proyek_id", label: "Proyek", type: "select", ref: { table: "proyek", label: "nama" }, required: true, list: false },
      { key: "nama", label: "Persiapan", type: "text", required: true },
      { key: "selesai", label: "Selesai", type: "bool" },
      { key: "catatan", label: "Catatan", type: "text" },
      { key: "urutan", label: "Urutan", type: "number" },
    ],
  },
  catatan_proyek: {
    table: "catatan_proyek",
    title: "Catatan Tambahan",
    nameKey: "judul",
    editors: ["owner", "admin_pusat"],
    fields: [
      { key: "proyek_id", label: "Proyek", type: "select", ref: { table: "proyek", label: "nama" }, required: true, list: false },
      { key: "tanggal", label: "Tanggal", type: "date", required: true },
      { key: "judul", label: "Judul (mis. Kode warna cat dinding)", type: "text", required: true },
      { key: "isi", label: "Isi / detail (mis. Dulux 30YY 65/347, permintaan mitra via chat)", type: "text" },
    ],
  },
  usulan_tanggal: {
    table: "usulan_tanggal",
    title: "Usulan Tanggal",
    nameKey: "jenis",
    editors: ["owner", "admin_pusat", "mitra"],
    fields: [
      { key: "proyek_id", label: "Proyek", type: "select", ref: { table: "proyek", label: "nama" }, required: true, list: false },
      { key: "jenis", label: "Untuk", type: "enum", options: ["Soft Opening", "Grand Opening"], required: true },
      { key: "tanggal", label: "Tanggal usulan", type: "date", required: true },
      { key: "catatan", label: "Alasan / catatan", type: "text" },
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
    } else if (f.type === "image" && !/^(\/menu\/[\w.-]+|https:\/\/[\w.-]+\.supabase\.co\/storage\/v1\/object\/public\/menu\/[\w./-]+)$/.test(v)) {
      errors.push(`${f.label} tidak valid`);
    } else if (f.type === "enum" && f.options && !f.options.includes(v)) {
      errors.push(`${f.label} tidak valid`);
    } else {
      out[f.key] = v;
    }
  }
  return { values: out, errors };
}
