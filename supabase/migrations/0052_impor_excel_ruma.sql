-- Impor file Excel Ruma (sheet Transaksi → catatan harian, sheet Laporan Keuangan → laporan bulanan).
-- Baris hasil impor ditandai impor_id agar impor ulang bisa mengganti data impor sebelumnya tanpa menyentuh input manual.
alter table biaya_outlet add column if not exists impor_id uuid;
alter table penjualan_manual add column if not exists impor_id uuid;
create index if not exists biaya_outlet_impor_idx on biaya_outlet (impor_id) where impor_id is not null;
create index if not exists penjualan_manual_impor_idx on penjualan_manual (impor_id) where impor_id is not null;
