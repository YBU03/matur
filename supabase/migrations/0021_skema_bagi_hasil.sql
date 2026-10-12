-- Skema bagi hasil yang bisa dipilih per outlet; admin bisa membuat skema sendiri.
-- rincian: [{penerima, persen, pengelola(bool), bank, no_rekening, atas_nama}] — total persen 100.
create table skema_bagi_hasil (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  keterangan text,
  persen_sedekah numeric not null default 2.5 check (persen_sedekah between 0 and 100),
  rincian jsonb not null default '[]',
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table skema_bagi_hasil enable row level security;
create policy baca on skema_bagi_hasil for select to authenticated using (punya_peran('{owner,admin_pusat,finance}'));
create policy kelola on skema_bagi_hasil for all to authenticated
  using (punya_peran('{owner,admin_pusat,finance}')) with check (punya_peran('{owner,admin_pusat,finance}'));
create trigger log_skema_bagi_hasil after insert or update or delete on skema_bagi_hasil for each row execute function catat_log();

alter table outlet add column skema_bagi_hasil_id uuid references skema_bagi_hasil;

with s as (
  insert into skema_bagi_hasil (nama, keterangan, rincian) values
  ('Internal 90/5/5', 'Format laporan outlet internal (Ruma Kopiaksa): pengelola 90%, dua mitra masing-masing 5%.',
   '[{"penerima":"Pengelola","persen":90,"pengelola":true},{"penerima":"Ibu Prasetya Ida Suntari","persen":5,"pengelola":false,"bank":"BSI","no_rekening":"7350338987","atas_nama":"Prasetya Ida Suntari"},{"penerima":"Ibu Oktantina Ratnasari","persen":5,"pengelola":false}]'),
  ('Kemitraan 55/45', 'Mitra 55%, pengelola 45%.', '[{"penerima":"Mitra","persen":55,"pengelola":false},{"penerima":"Pengelola","persen":45,"pengelola":true}]'),
  ('Kemitraan 50/50', 'Bagi rata mitra dan pengelola.', '[{"penerima":"Mitra","persen":50,"pengelola":false},{"penerima":"Pengelola","persen":50,"pengelola":true}]')
  returning id, nama
)
update outlet set skema_bagi_hasil_id = (select id from s where nama = 'Internal 90/5/5') where id = 'de5b97c8-31fc-4daf-9478-a19e675503e1';
