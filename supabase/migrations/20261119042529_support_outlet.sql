-- Kontak bersama untuk semua Mitra. Pengelolaan hanya Owner/Admin Pusat.
create table public.support_outlet (
 id uuid primary key default gen_random_uuid(),
 bagian text not null check(length(trim(bagian)) between 1 and 80),
 nama text not null check(length(trim(nama)) between 1 and 120),
 nomor text not null check(nomor ~ '^62[1-9][0-9]{7,12}$'),
 aktif boolean not null default true,
 urutan integer not null default 0 check(urutan between 0 and 9999),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default clock_timestamp(),
 deleted_at timestamptz
);
alter table public.support_outlet enable row level security;
revoke all on public.support_outlet from public, anon, authenticated;
grant select on public.support_outlet to authenticated;
grant insert(id,bagian,nama,nomor,aktif,urutan) on public.support_outlet to authenticated;
grant update(bagian,nama,nomor,aktif,urutan,deleted_at) on public.support_outlet to authenticated;

create policy support_baca on public.support_outlet for select to authenticated using (
 exists(select 1 from public.pengguna p where p.id=(select auth.uid()) and p.status='aktif')
 and (public.punya_peran('{owner,admin_pusat}') or
 (public.punya_peran('{mitra}') and aktif and deleted_at is null))
);
create policy support_tambah on public.support_outlet for insert to authenticated with check (
 exists(select 1 from public.pengguna p where p.id=(select auth.uid()) and p.status='aktif')
 and public.punya_peran('{owner,admin_pusat}') and deleted_at is null
);
create policy support_ubah on public.support_outlet for update to authenticated using (
 exists(select 1 from public.pengguna p where p.id=(select auth.uid()) and p.status='aktif')
 and public.punya_peran('{owner,admin_pusat}') and deleted_at is null
) with check (
 exists(select 1 from public.pengguna p where p.id=(select auth.uid()) and p.status='aktif')
 and public.punya_peran('{owner,admin_pusat}')
);

create function public.support_outlet_stamp() returns trigger
language plpgsql security invoker set search_path='' as $$
begin new.updated_at:=clock_timestamp();return new;end $$;
revoke all on function public.support_outlet_stamp() from public,anon,authenticated;
create trigger support_stamp before update on public.support_outlet for each row execute function public.support_outlet_stamp();
create trigger support_log after insert or update or delete on public.support_outlet for each row execute function public.catat_log();

insert into public.support_outlet(bagian,nama,nomor,urutan) values
 ('HRD','Deva/Fajri','6285135990588',10),
 ('HRD Operasional','Zahro','6285117189020',20),
 ('Warehouse','Isma','6285697865737',30),
 ('Akunting','Faika','6282220172355',40),
 ('Marketing','Ratna/Dian/Yoga','6285122637511',50);
