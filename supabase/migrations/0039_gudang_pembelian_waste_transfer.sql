-- Gudang: pembelian ke supplier (PB-YYMM-###), waste/barang rusak, transfer stok antar outlet.
create table pembelian (
  id uuid primary key default gen_random_uuid(),
  mode mode_data not null default 'asli',
  nomor text unique,
  supplier_id uuid references supplier,
  tanggal date not null default current_date,
  no_faktur text,
  status text not null default 'draft' check (status in ('draft','diterima','batal')),
  total bigint not null default 0,
  catatan text,
  dibuat_oleh uuid default auth.uid() references pengguna,
  diterima_at timestamptz,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create table item_pembelian (
  id uuid primary key default gen_random_uuid(),
  pembelian_id uuid not null references pembelian on delete cascade,
  bahan_id uuid not null references bahan,
  nama text not null,
  satuan text,
  konversi numeric not null default 1,
  qty numeric not null check (qty > 0),
  harga bigint not null default 0
);
create or replace function nomor_pembelian() returns trigger language plpgsql security definer set search_path = public as $$
declare pfx text := 'PB-' || to_char(coalesce(new.tanggal, current_date), 'YYMM') || '-';
begin
  if new.nomor is null then
    perform pg_advisory_xact_lock(hashtext('nomor_pembelian'));
    select pfx || lpad((coalesce(max(substring(nomor from length(pfx) + 1)::int), 0) + 1)::text, 3, '0') into new.nomor from pembelian where nomor like pfx || '%';
  end if;
  return new;
end $$;
create trigger nomor_pembelian before insert on pembelian for each row execute function nomor_pembelian();

alter table pembelian enable row level security;
alter table item_pembelian enable row level security;
create policy baca on pembelian for select using (gudang_pusat() or punya_peran('{finance}'));
create policy kelola on pembelian for all using (gudang_pusat()) with check (gudang_pusat());
create policy baca on item_pembelian for select using (gudang_pusat() or punya_peran('{finance}'));
create policy kelola on item_pembelian for all using (gudang_pusat()) with check (gudang_pusat());

create or replace function terima_pembelian(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare g pembelian; it item_pembelian;
begin
  if not gudang_pusat() then raise exception 'Hanya Admin Gudang/Pusat'; end if;
  select * into g from pembelian where id = p_id for update;
  if g.id is null or g.status <> 'draft' then raise exception 'Pembelian tidak bisa diterima (bukan draft)'; end if;
  if not exists (select 1 from item_pembelian where pembelian_id = p_id) then raise exception 'Belum ada barang'; end if;
  for it in select * from item_pembelian where pembelian_id = p_id loop
    perform geser_stok(g.mode, null, it.bahan_id, it.qty * it.konversi, 'pembelian', p_id, 'Pembelian ' || g.nomor);
    if it.harga > 0 then
      update bahan set harga_beli = it.harga, harga_pokok = round(it.harga / greatest(it.konversi, 0.001), 4) where id = it.bahan_id;
    end if;
  end loop;
  update pembelian set status = 'diterima', diterima_at = now(),
    total = (select coalesce(sum(round(qty * harga)), 0) from item_pembelian where pembelian_id = p_id) where id = p_id;
end $$;

create or replace function catat_waste(p_outlet uuid, p_bahan uuid, p_jumlah numeric, p_alasan text) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_jumlah is null or p_jumlah <= 0 then raise exception 'Jumlah harus lebih dari 0'; end if;
  if coalesce(trim(p_alasan), '') = '' then raise exception 'Alasan wajib diisi'; end if;
  if not (gudang_pusat() or (p_outlet is not null and peran_di_outlet(p_outlet, '{spv}'))) then raise exception 'Tidak diizinkan'; end if;
  perform geser_stok('asli', p_outlet, p_bahan, -p_jumlah, 'waste', null, 'Waste: ' || trim(p_alasan));
end $$;

create table transfer_stok (
  id uuid primary key default gen_random_uuid(),
  dari_outlet uuid not null references outlet,
  ke_outlet uuid not null references outlet,
  items jsonb not null,
  catatan text,
  oleh uuid default auth.uid() references pengguna,
  created_at timestamptz not null default now(),
  check (dari_outlet <> ke_outlet)
);
alter table transfer_stok enable row level security;
create policy baca on transfer_stok for select using (boleh_outlet(dari_outlet) or boleh_outlet(ke_outlet));

create or replace function transfer_stok_outlet(p_dari uuid, p_ke uuid, p_items jsonb, p_catatan text) returns uuid language plpgsql security definer set search_path = public as $$
declare v uuid; it jsonb; nd text; nk text;
begin
  if p_dari = p_ke then raise exception 'Outlet asal dan tujuan sama'; end if;
  if not (gudang_pusat() or peran_di_outlet(p_dari, '{spv}')) then raise exception 'Hanya Admin Gudang atau SPV outlet asal'; end if;
  if jsonb_array_length(coalesce(p_items, '[]')) = 0 then raise exception 'Belum ada bahan'; end if;
  select nama into nd from outlet where id = p_dari;
  select nama into nk from outlet where id = p_ke;
  insert into transfer_stok (dari_outlet, ke_outlet, items, catatan) values (p_dari, p_ke, p_items, nullif(trim(p_catatan), '')) returning id into v;
  for it in select * from jsonb_array_elements(p_items) loop
    if (it->>'jumlah')::numeric <= 0 then raise exception 'Jumlah tidak valid'; end if;
    perform geser_stok('asli', p_dari, (it->>'bahan_id')::uuid, -(it->>'jumlah')::numeric, 'transfer_keluar', v, 'Transfer ke ' || nk);
    perform geser_stok('asli', p_ke, (it->>'bahan_id')::uuid, (it->>'jumlah')::numeric, 'transfer_masuk', v, 'Transfer dari ' || nd);
  end loop;
  return v;
end $$;

grant execute on function terima_pembelian(uuid), catat_waste(uuid, uuid, numeric, text), transfer_stok_outlet(uuid, uuid, jsonb, text) to authenticated;
