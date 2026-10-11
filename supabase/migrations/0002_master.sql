-- Matur · Tahap 2: data master (MST-01..08), tempat sampah 30 hari (AKS-07).

create table supplier (
  id uuid primary key default gen_random_uuid(),
  mode mode_data not null default 'asli',
  nama text not null, kontak text, alamat text,
  deleted_at timestamptz
);

create table kategori_menu (
  id uuid primary key default gen_random_uuid(),
  mode mode_data not null default 'asli',
  nama text not null, urutan int not null default 0,
  deleted_at timestamptz
);

-- MST-04: harga per kanal (dine-in vs ojol bisa berbeda)
create table menu (
  id uuid primary key default gen_random_uuid(),
  mode mode_data not null default 'asli',
  kategori_id uuid references kategori_menu,
  nama text not null,
  harga_langsung bigint not null default 0,
  harga_ojol bigint not null default 0,
  aktif boolean not null default true,
  deleted_at timestamptz
);

-- ukuran, es/panas, gula, extra shot
create table varian (
  id uuid primary key default gen_random_uuid(),
  mode mode_data not null default 'asli',
  menu_id uuid not null references menu,
  grup text not null,            -- mis. "Ukuran", "Suhu", "Extra"
  nama text not null,            -- mis. "Large", "Es", "Extra shot"
  tambahan_harga bigint not null default 0,
  deleted_at timestamptz
);

-- MST-06: 1 karton susu = 12 L → konversi = 12000 (ml per satuan beli)
create table bahan (
  id uuid primary key default gen_random_uuid(),
  mode mode_data not null default 'asli',
  nama text not null,
  satuan_beli text not null,
  satuan_pakai text not null,
  konversi numeric(12,3) not null default 1,
  stok_min numeric(12,3) not null default 0,
  harga_pokok bigint not null default 0,  -- per satuan pakai, rata-rata tertimbang (GDG-01)
  supplier_id uuid references supplier,
  deleted_at timestamptz
);

-- MST-05: Es Kopi Susu = 18 g espresso + 150 ml susu + 20 ml gula aren + 1 cup
create table resep (
  id uuid primary key default gen_random_uuid(),
  mode mode_data not null default 'asli',
  menu_id uuid not null references menu,
  varian_id uuid references varian,       -- null = berlaku untuk semua varian
  bahan_id uuid not null references bahan,
  takaran numeric(12,3) not null,          -- dalam satuan pakai
  deleted_at timestamptz
);

create table karyawan (
  id uuid primary key default gen_random_uuid(),
  mode mode_data not null default 'asli',
  pengguna_id uuid references pengguna,
  outlet_id uuid references outlet,        -- outlet utama
  nama text not null,
  jabatan text not null,
  is_spv boolean not null default false,
  tgl_masuk date,
  status text not null default 'aktif' check (status in ('aktif','nonaktif')),
  deleted_at timestamptz
);

-- MST-08: urutan mengikuti format laporan resmi
create table kategori_biaya (
  id uuid primary key default gen_random_uuid(),
  nama text not null unique,
  urutan int not null
);
insert into kategori_biaya (nama, urutan) values
  ('Biaya Marketing',1),('Biaya Maintenance',2),('Biaya Distribusi',3),('Biaya Gaji',4),
  ('Biaya Listrik',5),('Biaya Internet',6),('Biaya Air',7),('Biaya Sewa',8),
  ('Biaya Perlengkapan',9),('Biaya Pemeliharaan Lingkungan',10),('Biaya Admin Transfer',11),
  ('Biaya Loker',12),('Biaya Lain Lain',13);

alter table outlet add column kota text;

-- ---------- RLS ----------
do $$
declare t text;
begin
  foreach t in array array['supplier','kategori_menu','menu','varian','bahan','resep','karyawan','kategori_biaya'] loop
    execute format('alter table %I enable row level security', t);
  end loop;
  -- data menu & bahan dibaca semua staf; dikelola owner/admin pusat (gudang untuk bahan & supplier)
  foreach t in array array['kategori_menu','menu','varian','resep'] loop
    execute format('create policy baca on %I for select to authenticated using (true)', t);
    execute format($p$create policy kelola on %I for all to authenticated
      using (punya_peran('{owner,admin_pusat}')) with check (punya_peran('{owner,admin_pusat}'))$p$, t);
  end loop;
  foreach t in array array['bahan','supplier'] loop
    execute format('create policy baca on %I for select to authenticated using (true)', t);
    execute format($p$create policy kelola on %I for all to authenticated
      using (punya_peran('{owner,admin_pusat,admin_gudang}')) with check (punya_peran('{owner,admin_pusat,admin_gudang}'))$p$, t);
  end loop;
  foreach t in array array['supplier','kategori_menu','menu','varian','bahan','resep','karyawan'] loop
    execute format('create trigger log_%s after insert or update or delete on %I for each row execute function catat_log()', t, t);
  end loop;
end $$;

create policy baca on kategori_biaya for select to authenticated using (true);

create policy baca on karyawan for select to authenticated
  using (punya_peran('{owner,hrd,admin_pusat,finance}') or boleh_outlet(outlet_id) or pengguna_id = auth.uid());
create policy kelola on karyawan for all to authenticated
  using (punya_peran('{owner,hrd}')) with check (punya_peran('{owner,hrd}'));

create trigger log_mitra after insert or update or delete on mitra for each row execute function catat_log();
alter table mitra add column deleted_at timestamptz;

-- log memakai nama pengguna; owner bisa membaca
create or replace view log_view with (security_invoker = true) as
  select l.*, p.nama as pengguna_nama from log_aktivitas l left join pengguna p on p.id = l.pengguna_id;

-- AKS-07: pengosongan otomatis tempat sampah > 30 hari ditambahkan di migrasi berikutnya.
