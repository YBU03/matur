-- Admin Gudang ikut mengatur menu & harga POS (beserta foto), dan HPP per menu dari file "HPP RUMA".
do $$
declare t text;
begin
  foreach t in array array['kategori_menu','menu','varian','resep'] loop
    execute format('create policy kelola_gudang on %I for all to authenticated using (punya_peran(''{admin_gudang}'')) with check (punya_peran(''{admin_gudang}''))', t);
  end loop;
end $$;
create policy menu_unggah_gudang on storage.objects for insert to authenticated with check (bucket_id = 'menu' and punya_peran('{admin_gudang}'));

alter table bahan add column harga_jual_gudang bigint;   -- harga jual gudang ke outlet (per kemasan)

-- HPP per menu per seri (Ice / Hot / Can). komponen: [{nama, qty, satuan, harga_unit, biaya}]
create table hpp_menu (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid references menu,             -- kosong = belum dihubungkan ke menu POS
  nama_hpp text not null,
  seri text not null default 'Ice',
  komponen jsonb not null default '[]',
  total_hpp numeric not null default 0,
  harga_jual bigint,
  deleted_at timestamptz
);
alter table hpp_menu enable row level security;
create policy baca on hpp_menu for select to authenticated using (punya_peran('{owner,admin_pusat,admin_gudang,finance}'));
create policy kelola on hpp_menu for all to authenticated
  using (punya_peran('{owner,admin_pusat,admin_gudang}')) with check (punya_peran('{owner,admin_pusat,admin_gudang}'));
create trigger log_hpp_menu after insert or update or delete on hpp_menu for each row execute function catat_log();
