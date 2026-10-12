-- Bahan baku gudang: kategori, kemasan, harga beli, dan stok per lokasi
-- (outlet_id null = gudang pusat). Harga pokok per satuan pakai bisa pecahan rupiah
-- (mis. sirup Rp130,755/ml) agar HPP resep akurat.
alter table bahan
  add column kategori text not null default 'Lainnya',
  add column kemasan text,
  add column harga_beli bigint not null default 0,      -- per satuan beli
  add column catatan text,
  add column urutan int not null default 0;
alter table bahan alter column harga_pokok type numeric(14,4);

create table stok (
  id uuid primary key default gen_random_uuid(),
  mode mode_data not null default 'asli',
  outlet_id uuid references outlet,                      -- null = gudang pusat
  bahan_id uuid not null references bahan,
  jumlah numeric(14,3) not null default 0,               -- dalam satuan pakai
  updated_at timestamptz not null default now(),
  unique nulls not distinct (mode, outlet_id, bahan_id)
);
alter table stok enable row level security;
create policy baca on stok for select to authenticated
  using (punya_peran('{owner,admin_pusat,admin_gudang,finance}') or (outlet_id is not null and boleh_outlet(outlet_id)));
-- sementara stok bisa dikoreksi manual oleh gudang; pembelian/kiriman/opname menyusul (GDG-01..09)
create policy kelola on stok for all to authenticated
  using (punya_peran('{owner,admin_pusat,admin_gudang}')) with check (punya_peran('{owner,admin_pusat,admin_gudang}'));
create trigger log_stok after insert or update or delete on stok for each row execute function catat_log();
