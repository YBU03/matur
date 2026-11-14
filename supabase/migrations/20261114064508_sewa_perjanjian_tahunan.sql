-- Sewa perjanjian diinput tahunan. Kolom bulanan lama tetap rupiah bulat untuk klien lama.
alter table public.perjanjian add column sewa_tahunan bigint;
update public.perjanjian set sewa_tahunan=sewa_bulanan*12;
-- Koreksi eksplisit nilai yang dikonfirmasi pemilik, hanya dua perjanjian asli ini.
do $$begin
 if exists(select 1 from public.perjanjian where id='e9074d01-68b5-4eb7-a06e-8a8b40a2c4ac' and mode='asli' and sewa_bulanan<>1416667) then raise exception 'Sewa Kominot berubah; periksa sebelum migrasi';end if;
 if exists(select 1 from public.perjanjian where id='a8786407-384b-4fd3-aaad-fc1d7711a288' and mode='asli' and sewa_bulanan<>25000000) then raise exception 'Sewa UHB berubah; periksa sebelum migrasi';end if;
end $$;
update public.perjanjian set sewa_tahunan=17000000,sewa_bulanan=1416667 where id='e9074d01-68b5-4eb7-a06e-8a8b40a2c4ac' and mode='asli';
update public.perjanjian set sewa_tahunan=25000000,sewa_bulanan=2083333 where id='a8786407-384b-4fd3-aaad-fc1d7711a288' and mode='asli';
alter table public.perjanjian alter column sewa_tahunan set not null;
alter table public.perjanjian alter column sewa_tahunan set default 0;
alter table public.perjanjian add constraint perjanjian_sewa_tahunan_valid check(sewa_tahunan between 0 and 1000000000000);
create schema if not exists perjanjian_internal;
revoke all on schema perjanjian_internal from public,anon;
create function perjanjian_internal.sinkron_sewa() returns trigger
language plpgsql security invoker set search_path=pg_catalog as $$
begin
 if tg_op='INSERT' then
   if coalesce(new.sewa_tahunan,0)=0 and coalesce(new.sewa_bulanan,0)<>0 then
     new.sewa_tahunan:=new.sewa_bulanan*12;
   end if;
 elsif new.sewa_tahunan is not distinct from old.sewa_tahunan and new.sewa_bulanan is distinct from old.sewa_bulanan then
   -- Kompatibilitas klien lama yang masih mengedit bulanan.
   new.sewa_tahunan:=coalesce(new.sewa_bulanan,0)*12;
 end if;
 new.sewa_tahunan:=coalesce(new.sewa_tahunan,0);
 new.sewa_bulanan:=round(new.sewa_tahunan::numeric/12)::bigint;
 return new;
end $$;
revoke all on function perjanjian_internal.sinkron_sewa() from public,anon,authenticated;
create trigger sinkron_sewa_perjanjian before insert or update of sewa_tahunan,sewa_bulanan on public.perjanjian for each row execute function perjanjian_internal.sinkron_sewa();
