-- Kiriman bahan baku gudang pusat → outlet, lengkap dengan surat jalan & invoice.
-- Stok disimpan dalam satuan pakai; qty kiriman dalam satuan beli (kemasan) × konversi.
create table kiriman (
  id uuid primary key default gen_random_uuid(),
  mode mode_data not null default 'asli',
  nomor text unique,
  outlet_id uuid not null references outlet,
  tanggal date not null default current_date,
  status text not null default 'draft' check (status in ('draft','dikirim','diterima','batal')),
  catatan text,
  pengirim text,
  total bigint not null default 0,
  dibuat_oleh uuid references pengguna default auth.uid(),
  dikirim_at timestamptz,
  diterima_at timestamptz,
  diterima_oleh uuid references pengguna,
  nama_penerima text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create table item_kiriman (
  id uuid primary key default gen_random_uuid(),
  kiriman_id uuid not null references kiriman on delete cascade,
  bahan_id uuid not null references bahan,
  nama text not null,
  satuan text,
  konversi numeric not null default 1 check (konversi > 0),
  qty numeric not null check (qty > 0),
  harga bigint not null default 0 check (harga >= 0),
  qty_diterima numeric,
  catatan text
);
-- riwayat pergerakan stok (dasar laporan persediaan & HPP)
create table mutasi_stok (
  id uuid primary key default gen_random_uuid(),
  mode mode_data not null default 'asli',
  outlet_id uuid references outlet,          -- kosong = gudang pusat
  bahan_id uuid not null references bahan,
  jumlah numeric not null,                   -- satuan pakai, + masuk / − keluar
  jenis text not null check (jenis in ('kiriman_keluar','kiriman_masuk','kiriman_batal','opname','pembelian','pemakaian','koreksi')),
  ref_id uuid,
  keterangan text,
  dibuat_oleh uuid references pengguna default auth.uid(),
  created_at timestamptz not null default now()
);

create or replace function gudang_pusat() returns boolean
language sql stable security definer set search_path = public as $$
  select punya_peran('{owner,admin_pusat,admin_gudang}')
$$;
revoke execute on function gudang_pusat() from public, anon;
grant execute on function gudang_pusat() to authenticated;

-- nomor otomatis KRM-YYMM-001
create or replace function nomor_kiriman() returns trigger
language plpgsql security definer set search_path = public as $$
declare pfx text := 'KRM-' || to_char(coalesce(new.tanggal, current_date), 'YYMM') || '-';
begin
  if new.nomor is null then
    perform pg_advisory_xact_lock(hashtext('nomor_kiriman'));
    select pfx || lpad((coalesce(max(substring(nomor from length(pfx) + 1)::int), 0) + 1)::text, 3, '0') into new.nomor
      from kiriman where nomor like pfx || '%';
  end if;
  return new;
end $$;
create trigger nomor_kiriman before insert on kiriman for each row execute function nomor_kiriman();

alter table kiriman enable row level security;
alter table item_kiriman enable row level security;
alter table mutasi_stok enable row level security;
create policy baca on kiriman for select to authenticated using (punya_peran('{owner,admin_pusat,admin_gudang,finance}') or boleh_outlet(outlet_id));
create policy tambah on kiriman for insert to authenticated with check (gudang_pusat() and status = 'draft');
create policy ubah_draft on kiriman for update to authenticated using (gudang_pusat() and status = 'draft') with check (gudang_pusat() and status in ('draft','batal'));
create policy baca on item_kiriman for select to authenticated using (exists (select 1 from kiriman k where k.id = kiriman_id));
create policy kelola_draft on item_kiriman for all to authenticated
  using (gudang_pusat() and exists (select 1 from kiriman k where k.id = kiriman_id and k.status = 'draft'))
  with check (gudang_pusat() and exists (select 1 from kiriman k where k.id = kiriman_id and k.status = 'draft'));
create policy baca on mutasi_stok for select to authenticated using (punya_peran('{owner,admin_pusat,admin_gudang,finance}') or (outlet_id is not null and boleh_outlet(outlet_id)));
create trigger log_kiriman after insert or update or delete on kiriman for each row execute function catat_log();

-- ubah stok (satuan pakai) + catat mutasi
create or replace function geser_stok(p_mode mode_data, p_outlet uuid, p_bahan uuid, p_jumlah numeric, p_jenis text, p_ref uuid, p_ket text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update stok set jumlah = jumlah + p_jumlah, updated_at = now()
   where mode = p_mode and outlet_id is not distinct from p_outlet and bahan_id = p_bahan;
  if not found then
    insert into stok (mode, outlet_id, bahan_id, jumlah) values (p_mode, p_outlet, p_bahan, p_jumlah);
  end if;
  insert into mutasi_stok (mode, outlet_id, bahan_id, jumlah, jenis, ref_id, keterangan) values (p_mode, p_outlet, p_bahan, p_jumlah, p_jenis, p_ref, p_ket);
end $$;
revoke execute on function geser_stok(mode_data, uuid, uuid, numeric, text, uuid, text) from public, anon, authenticated;

create or replace function kirim_kiriman(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare k kiriman; i item_kiriman;
begin
  if not gudang_pusat() then raise exception 'Hanya Admin Gudang / Pusat'; end if;
  select * into k from kiriman where id = p_id for update;
  if k.id is null or k.status <> 'draft' then raise exception 'Kiriman tidak ditemukan atau sudah dikirim'; end if;
  if not exists (select 1 from item_kiriman where kiriman_id = p_id) then raise exception 'Tambahkan barang dulu'; end if;
  for i in select * from item_kiriman where kiriman_id = p_id loop
    perform geser_stok(k.mode, null, i.bahan_id, -(i.qty * i.konversi), 'kiriman_keluar', p_id, k.nomor);
  end loop;
  update kiriman set status = 'dikirim', dikirim_at = now(),
    total = (select coalesce(sum(round(qty * harga)), 0) from item_kiriman where kiriman_id = p_id)
   where id = p_id;
end $$;

-- p_items: [{id, qty_diterima}] — kosong = diterima sesuai jumlah kirim
create or replace function terima_kiriman(p_id uuid, p_items jsonb, p_penerima text) returns void
language plpgsql security definer set search_path = public as $$
declare k kiriman; i item_kiriman; q numeric;
begin
  select * into k from kiriman where id = p_id for update;
  if k.id is null or k.status <> 'dikirim' then raise exception 'Kiriman belum dikirim atau sudah diterima'; end if;
  if not (gudang_pusat() or peran_di_outlet(k.outlet_id, '{spv,kasir,barista}')) then raise exception 'Tidak diizinkan menerima kiriman outlet ini'; end if;
  for i in select * from item_kiriman where kiriman_id = p_id loop
    q := coalesce((select (x->>'qty_diterima')::numeric from jsonb_array_elements(coalesce(p_items, '[]')) x where x->>'id' = i.id::text), i.qty);
    if q < 0 then raise exception 'Jumlah diterima tidak boleh negatif'; end if;
    update item_kiriman set qty_diterima = q where id = i.id;
    if q > 0 then perform geser_stok(k.mode, k.outlet_id, i.bahan_id, q * i.konversi, 'kiriman_masuk', p_id, k.nomor); end if;
    -- selisih (barang kurang/rusak) dikembalikan ke stok gudang
    if q < i.qty then perform geser_stok(k.mode, null, i.bahan_id, (i.qty - q) * i.konversi, 'koreksi', p_id, k.nomor || ' selisih terima'); end if;
  end loop;
  update kiriman set status = 'diterima', diterima_at = now(), diterima_oleh = auth.uid(), nama_penerima = left(nullif(trim(p_penerima), ''), 100),
    total = (select coalesce(sum(round(coalesce(qty_diterima, qty) * harga)), 0) from item_kiriman where kiriman_id = p_id)
   where id = p_id;
end $$;

create or replace function batal_kiriman(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare k kiriman; i item_kiriman;
begin
  if not gudang_pusat() then raise exception 'Hanya Admin Gudang / Pusat'; end if;
  select * into k from kiriman where id = p_id for update;
  if k.id is null or k.status not in ('draft','dikirim') then raise exception 'Kiriman tidak bisa dibatalkan'; end if;
  if k.status = 'dikirim' then
    for i in select * from item_kiriman where kiriman_id = p_id loop
      perform geser_stok(k.mode, null, i.bahan_id, i.qty * i.konversi, 'kiriman_batal', p_id, k.nomor);
    end loop;
  end if;
  update kiriman set status = 'batal' where id = p_id;
end $$;

do $$
declare f text;
begin
  foreach f in array array['kirim_kiriman(uuid)','terima_kiriman(uuid, jsonb, text)','batal_kiriman(uuid)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
