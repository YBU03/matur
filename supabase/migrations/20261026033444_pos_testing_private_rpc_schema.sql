-- Schema khusus RPC training; tidak memberi USAGE pada seluruh matur_internal.
create schema pos_training_internal;
revoke all on schema pos_training_internal from public,anon;
grant usage on schema pos_training_internal to authenticated;
alter function matur_internal.admin_testing_outlet(uuid) set schema pos_training_internal;
alter function matur_internal.panel_testing_outlet() set schema pos_training_internal;
alter function matur_internal.atur_testing_outlet(uuid,boolean,timestamptz) set schema pos_training_internal;
alter function matur_internal.status_testing_outlet(uuid) set schema pos_training_internal;
-- HRD sesuai penugasan outlet; pusat/owner seluruh outlet. Tabel tetap privat.
create or replace function pos_training_internal.admin_testing_outlet(p_outlet uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(
  select 1 from public.pengguna u join public.penugasan p on p.pengguna_id=u.id
  where u.id=auth.uid() and u.status='aktif' and
   (p.peran in ('owner','admin_pusat') or p.peran='hrd' and (p.outlet_id is null or p.outlet_id=p_outlet)))
$$;
create or replace function pos_training_internal.panel_testing_outlet() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not exists(select 1 from public.pengguna u join public.penugasan p on p.pengguna_id=u.id where u.id=auth.uid() and u.status='aktif' and p.peran in ('owner','admin_pusat','hrd')) then raise exception 'Hanya HRD/Admin Pusat/Owner yang dapat mengatur testing';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'nama',o.nama,'aktif',coalesce(t.aktif,false),'versi',t.diubah_at) order by o.nama),'[]')
 from public.outlet o left join matur_internal.pos_testing t on t.outlet_id=o.id
 where o.deleted_at is null and pos_training_internal.admin_testing_outlet(o.id));
end $$;
create or replace function pos_training_internal.atur_testing_outlet(p_outlet uuid,p_aktif boolean,p_versi timestamptz) returns void
language plpgsql security definer set search_path='' as $$
declare v timestamptz;
begin
 if not pos_training_internal.admin_testing_outlet(p_outlet) then raise exception 'Tidak berwenang mengatur testing outlet ini';end if;
 if p_aktif is null then raise exception 'Pilih status mode testing';end if;
 -- Kunci outlet juga menyerialkan pengaturan pertama (belum ada baris testing).
 perform 1 from public.outlet where id=p_outlet and deleted_at is null for update;
 if not found then raise exception 'Outlet tidak tersedia';end if;
 select diubah_at into v from matur_internal.pos_testing where outlet_id=p_outlet;
 if v is distinct from p_versi then raise exception 'Pengaturan sudah berubah. Muat ulang halaman';end if;
 insert into matur_internal.pos_testing(outlet_id,aktif,diubah_at,diubah_oleh)
 values(p_outlet,p_aktif,clock_timestamp(),auth.uid())
 on conflict(outlet_id) do update set aktif=excluded.aktif,diubah_at=excluded.diubah_at,diubah_oleh=excluded.diubah_oleh;
 insert into public.log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_baru)
 values(auth.uid(),'atur_testing_pos','outlet',p_outlet::text,jsonb_build_object('aktif',p_aktif));
end $$;
create or replace function pos_training_internal.status_testing_outlet(p_outlet uuid) returns boolean
language plpgsql stable security definer set search_path='' as $$
begin
 if not pos_training_internal.admin_testing_outlet(p_outlet) and not public.peran_di_outlet(p_outlet,'{kasir,barista,spv}') then raise exception 'Tidak berwenang mengakses outlet ini';end if;
 return exists(select 1 from matur_internal.pos_testing t join public.outlet o on o.id=t.outlet_id where t.outlet_id=p_outlet and t.aktif and o.deleted_at is null);
end $$;
create or replace function public.panel_testing_pos() returns jsonb
language sql stable security invoker set search_path='' as $$select pos_training_internal.panel_testing_outlet()$$;
create or replace function public.atur_testing_pos(p_outlet uuid,p_aktif boolean,p_versi timestamptz) returns void
language sql security invoker set search_path='' as $$select pos_training_internal.atur_testing_outlet(p_outlet,p_aktif,p_versi)$$;
create or replace function public.status_testing_pos(p_outlet uuid) returns boolean
language sql stable security invoker set search_path='' as $$select pos_training_internal.status_testing_outlet(p_outlet)$$;
revoke all on function pos_training_internal.admin_testing_outlet(uuid) from public,anon,authenticated;
revoke all on function pos_training_internal.panel_testing_outlet(),pos_training_internal.atur_testing_outlet(uuid,boolean,timestamptz),pos_training_internal.status_testing_outlet(uuid) from public,anon;
grant execute on function pos_training_internal.panel_testing_outlet(),pos_training_internal.atur_testing_outlet(uuid,boolean,timestamptz),pos_training_internal.status_testing_outlet(uuid) to authenticated;
revoke all on function public.panel_testing_pos(),public.atur_testing_pos(uuid,boolean,timestamptz),public.status_testing_pos(uuid) from public,anon;
grant execute on function public.panel_testing_pos(),public.atur_testing_pos(uuid,boolean,timestamptz),public.status_testing_pos(uuid) to authenticated;
