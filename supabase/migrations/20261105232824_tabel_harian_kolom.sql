-- Catatan Harian (Tabel Excel): susunan kolom bersama akunting + tambah / ganti nama kategori pengeluaran.
alter table public.perusahaan add column if not exists tabel_harian jsonb not null default '{}'::jsonb;

create or replace function public.atur_tabel_harian(p_susunan jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not punya_peran('{owner,admin_pusat,finance}') then raise exception 'Hanya Owner/Admin Pusat/Finance'; end if;
  if jsonb_typeof(coalesce(p_susunan, '{}')) <> 'object' or length(p_susunan::text) > 20000 then raise exception 'Susunan kolom tidak valid'; end if;
  update perusahaan set tabel_harian = jsonb_build_object(
    'urutan', coalesce(p_susunan->'urutan', '[]'), 'sembunyi', coalesce(p_susunan->'sembunyi', '[]'),
    'tampil', coalesce(p_susunan->'tampil', '[]'), 'lebar', coalesce(p_susunan->'lebar', '{}')) where id is not null;
  insert into log_aktivitas(pengguna_id, aksi, entitas, entitas_id, nilai_baru) values (auth.uid(), 'atur_tabel_harian', 'perusahaan', null, p_susunan);
end $$;
revoke all on function public.atur_tabel_harian(jsonb) from public, anon;
grant execute on function public.atur_tabel_harian(jsonb) to authenticated;

create or replace function public.tambah_kategori_biaya(p_nama text, p_grup text)
returns uuid language plpgsql security definer set search_path = public as $$
declare n text := left(trim(coalesce(p_nama, '')), 60); g text := coalesce(nullif(p_grup, ''), 'beban'); id_baru uuid;
begin
  if not punya_peran('{owner,admin_pusat,finance}') then raise exception 'Hanya Owner/Admin Pusat/Finance'; end if;
  if length(n) < 3 then raise exception 'Nama kategori minimal 3 huruf'; end if;
  if g not in ('hpp', 'beban', 'lain') then raise exception 'Grup tidak valid'; end if;
  if exists (select 1 from kategori_biaya where lower(nama) = lower(n)) then raise exception 'Kategori "%" sudah ada', n; end if;
  insert into kategori_biaya(nama, grup, urutan, harian)
  values (n, g, coalesce((select max(urutan) from kategori_biaya where grup = g), case g when 'hpp' then 100 when 'lain' then 200 else 0 end) + 1, true)
  returning id into id_baru;
  insert into log_aktivitas(pengguna_id, aksi, entitas, entitas_id, nilai_baru) values (auth.uid(), 'tambah_kategori_biaya', 'kategori_biaya', id_baru::text, jsonb_build_object('nama', n, 'grup', g));
  return id_baru;
end $$;
revoke all on function public.tambah_kategori_biaya(text, text) from public, anon;
grant execute on function public.tambah_kategori_biaya(text, text) to authenticated;

create or replace function public.ganti_nama_kategori_biaya(p_id uuid, p_nama text)
returns void language plpgsql security definer set search_path = public as $$
declare n text := left(trim(coalesce(p_nama, '')), 60); lama text;
begin
  if not punya_peran('{owner,admin_pusat,finance}') then raise exception 'Hanya Owner/Admin Pusat/Finance'; end if;
  if length(n) < 3 then raise exception 'Nama kategori minimal 3 huruf'; end if;
  select nama into lama from kategori_biaya where id = p_id for update;
  if lama is null then raise exception 'Kategori tidak ditemukan'; end if;
  if exists (select 1 from kategori_biaya where lower(nama) = lower(n) and id <> p_id) then raise exception 'Kategori "%" sudah ada', n; end if;
  update kategori_biaya set nama = n where id = p_id;
  insert into log_aktivitas(pengguna_id, aksi, entitas, entitas_id, nilai_lama, nilai_baru) values (auth.uid(), 'ganti_nama_kategori_biaya', 'kategori_biaya', p_id::text, jsonb_build_object('nama', lama), jsonb_build_object('nama', n));
end $$;
revoke all on function public.ganti_nama_kategori_biaya(uuid, text) from public, anon;
grant execute on function public.ganti_nama_kategori_biaya(uuid, text) to authenticated;
