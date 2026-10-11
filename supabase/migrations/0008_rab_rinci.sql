-- Rincian keperluan proyek mengikuti format "Daftar Material dan Harga":
-- kelompok (kolom kategori: Material / Keperluan Interior / Pertukangan / …) → bagian → item.
alter table item_rab
  add column bagian text,
  add column spesifikasi text,
  add column satuan text,
  add column harga_satuan bigint,
  add column keterangan text,
  add column urutan int not null default 0;
alter table item_rab alter column kategori set default 'Material';
