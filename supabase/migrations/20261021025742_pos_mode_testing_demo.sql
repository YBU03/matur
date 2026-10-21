-- Explicit allowlist: initially only the existing demo outlet can use training mode.
create table matur_internal.pos_testing (
 outlet_id uuid primary key references public.outlet(id),
 aktif boolean not null default false,
 diubah_at timestamptz not null default clock_timestamp(),
 diubah_oleh uuid references public.pengguna(id)
);
alter table matur_internal.pos_testing enable row level security;
revoke all on matur_internal.pos_testing from public,anon,authenticated;
insert into matur_internal.pos_testing(outlet_id,aktif)
select o.id,true from public.outlet o join matur_internal.pos_outlet_akses a on a.outlet_id=o.id
where o.nama='Outlet Demo (uji coba)' and o.deleted_at is null and a.username='demo.pos' and a.deleted_at is null;

create function matur_internal.admin_testing_pos() returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.pengguna u join public.penugasan p on p.pengguna_id=u.id where u.id=auth.uid() and u.status='aktif' and p.peran in ('owner','admin_pusat'))
$$;
revoke all on function matur_internal.admin_testing_pos() from public,anon,authenticated;

create function public.panel_testing_pos() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not matur_internal.admin_testing_pos() then raise exception 'Hanya admin pusat/owner yang dapat mengatur mode testing';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'nama',o.nama,'aktif',t.aktif,'versi',t.diubah_at) order by o.nama),'[]') from matur_internal.pos_testing t join public.outlet o on o.id=t.outlet_id where o.deleted_at is null);
end $$;
create function public.atur_testing_pos(p_outlet uuid,p_aktif boolean,p_versi timestamptz) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not matur_internal.admin_testing_pos() then raise exception 'Hanya admin pusat/owner yang dapat mengatur mode testing';end if;
 if p_aktif is null then raise exception 'Pilih status mode testing';end if;
 update matur_internal.pos_testing t set aktif=p_aktif,diubah_at=clock_timestamp(),diubah_oleh=auth.uid()
 where t.outlet_id=p_outlet and t.diubah_at=p_versi and exists(select 1 from public.outlet o where o.id=t.outlet_id and o.deleted_at is null);
 if not found then raise exception 'Outlet tidak diizinkan untuk testing atau pengaturan sudah berubah. Muat ulang halaman';end if;
 insert into public.log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_baru)
 values(auth.uid(),'atur_testing_pos','outlet',p_outlet::text,jsonb_build_object('aktif',p_aktif));
end $$;
create function public.status_testing_pos(p_outlet uuid) returns boolean
language plpgsql stable security definer set search_path='' as $$
begin
 if not matur_internal.admin_testing_pos() and not public.peran_di_outlet(p_outlet,'{kasir,barista,spv}') then raise exception 'Tidak berwenang mengakses outlet ini';end if;
 return exists(select 1 from matur_internal.pos_testing t join public.outlet o on o.id=t.outlet_id where t.outlet_id=p_outlet and t.aktif and o.deleted_at is null);
end $$;
create function public.katalog_testing_pos(p_outlet uuid,p_device text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare dev uuid;
begin
 if not public.status_testing_pos(p_outlet) then raise exception 'Mode testing tidak aktif';end if;
 dev:=matur_internal.perangkat(p_outlet,p_device);
 if dev is null or not exists(select 1 from public.pos_perangkat d join matur_internal.pos_outlet_akses a on a.outlet_id=d.outlet_id where d.id=dev and d.akun_id=auth.uid() and a.aktif and a.deleted_at is null and d.kredensial_at>=a.diubah_at) then raise exception 'Masuk ulang dengan akun POS outlet yang aktif';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'nama',m.nama,'harga_langsung',m.harga_langsung,'harga_ojol',m.harga_ojol,'varian',(select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'nama',v.nama,'tambahan_harga',v.tambahan_harga) order by v.nama),'[]') from public.varian v where v.menu_id=m.id and v.deleted_at is null)) order by m.nama),'[]') from public.menu m where m.mode='asli' and m.aktif and m.deleted_at is null);
end $$;
revoke all on function public.panel_testing_pos(),public.atur_testing_pos(uuid,boolean,timestamptz),public.status_testing_pos(uuid),public.katalog_testing_pos(uuid,text) from public,anon;
grant execute on function public.panel_testing_pos(),public.atur_testing_pos(uuid,boolean,timestamptz),public.status_testing_pos(uuid),public.katalog_testing_pos(uuid,text) to authenticated;

-- A stale live-POS tab must not post new real sales while testing is enabled.
-- Existing offline sales from before activation can still reconcile through the original lease checks.
do $$ declare d text;needle text:=' p:=p-''_katalog'';';begin
 d:=pg_get_functiondef('public.buat_transaksi(jsonb)'::regprocedure);
 if position(needle in d)=0 then raise exception 'Definisi transaksi POS berubah';end if;
 d:=replace(d,needle,$patch$
 if exists(select 1 from matur_internal.pos_testing mt where mt.outlet_id=o and mt.aktif and (not off or coalesce(nullif(p->>'waktu_asli','')::timestamptz,clock_timestamp())>=mt.diubah_at)) then
  raise exception 'Mode testing aktif. Gunakan halaman testing; transaksi asli tidak dibuat';
 end if;
$patch$||needle);
 execute d;
end $$;
