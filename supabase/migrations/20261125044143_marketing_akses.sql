-- Marketing is a central role, with narrow sales/promo/schedule RPCs.
-- Deliberately do not add it to boleh_outlet, kelola_sdm, or financial roles.
create schema marketing_internal;
revoke all on schema marketing_internal from public,anon;
grant usage on schema marketing_internal to authenticated;
create function marketing_internal.akses() returns boolean language sql stable security definer set search_path='' as $$
 select public.punya_peran('{owner,admin_pusat}') or exists(select 1 from public.penugasan t join public.pengguna u on u.id=t.pengguna_id where t.pengguna_id=auth.uid() and t.peran='marketing' and t.outlet_id is null and u.status='aktif');
$$;
revoke all on function marketing_internal.akses() from public,anon;
grant execute on function marketing_internal.akses() to authenticated;
alter table public.penugasan add constraint marketing_semua_outlet check(peran<>'marketing' or outlet_id is null);

create or replace function matur_internal.outlet_pantau() returns setof uuid language sql stable security definer set search_path='' as $$
 select o.id from public.outlet o where o.deleted_at is null and exists(
 select 1 from public.penugasan t join public.pengguna u on u.id=t.pengguna_id and u.status='aktif'
 where t.pengguna_id=auth.uid() and (t.peran='owner' or (t.peran='marketing' and t.outlet_id is null) or (t.peran='pemantau_pos' and (t.outlet_id is null or t.outlet_id=o.id))));
$$;
create or replace function promo_internal.pusat() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.pengguna u where u.id=auth.uid() and u.status='aktif')
 and (public.punya_peran('{owner,admin_pusat,admin_gudang,hrd}') or exists(select 1 from public.penugasan t where t.pengguna_id=auth.uid() and t.peran='marketing' and t.outlet_id is null));
$$;
-- Keep existing account administration checks; only recognize the new central role.
do $patch$
declare sig text; f text;
begin
 foreach sig in array array['public.setujui_pengguna(uuid,public.peran,uuid)','public.edit_penugasan_pengguna(uuid,jsonb,public.peran,uuid)'] loop
 f:=pg_get_functiondef(sig::regprocedure);
 if strpos(f,'''admin_gudang''')=0 then raise exception 'Marketing: account role anchor changed';end if;
 execute replace(f,'''admin_gudang''','''admin_gudang'',''marketing''');
 end loop;
end $patch$;
-- Admin Pusat may assign/revoke this role, but never their own or an Owner's access.
create policy marketing_tambah_admin on public.penugasan for insert to authenticated with check(
 public.punya_peran('{admin_pusat}') and peran='marketing' and outlet_id is null and pengguna_id<>auth.uid()
 and not exists(select 1 from public.penugasan t where t.pengguna_id=penugasan.pengguna_id and t.peran='owner'));
create policy marketing_cabut_admin on public.penugasan for delete to authenticated using(
 public.punya_peran('{admin_pusat}') and peran='marketing' and pengguna_id<>auth.uid()
 and not exists(select 1 from public.penugasan t where t.pengguna_id=penugasan.pengguna_id and t.peran='owner'));

create function public.katalog_promo_marketing() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not marketing_internal.akses() then raise exception 'Hanya Marketing/Owner/Admin Pusat';end if;
 return jsonb_build_object(
 'outlets',coalesce((select jsonb_agg(jsonb_build_object('id',id,'nama',nama) order by nama) from public.outlet where mode='asli' and deleted_at is null),'[]'),
 'menus',coalesce((select jsonb_agg(jsonb_build_object('id',id,'nama',nama,'kemasan',kemasan,'harga_langsung',harga_langsung,'harga_ojol',harga_ojol,'kategori_id',kategori_id) order by nama) from public.menu where mode='asli' and aktif and deleted_at is null),'[]'),
 'variants',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'nama',v.nama,'grup',v.grup,'menu_id',v.menu_id) order by v.nama) from public.varian v join public.menu m on m.id=v.menu_id where v.deleted_at is null and m.mode='asli' and m.aktif and m.deleted_at is null),'[]'),
 'kategori',coalesce((select jsonb_agg(jsonb_build_object('id',id,'nama',nama) order by urutan) from public.kategori_menu where mode='asli' and deleted_at is null),'[]'));
end $$;
revoke all on function public.katalog_promo_marketing() from public,anon;
grant execute on function public.katalog_promo_marketing() to authenticated;

create function public.jadwal_marketing_hari_ini() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare hari date:=(now() at time zone 'Asia/Jakarta')::date;
begin
 if not marketing_internal.akses() then raise exception 'Hanya Marketing/Owner/Admin Pusat';end if;
 return jsonb_build_object('tanggal',hari,
 'outlets',coalesce((select jsonb_agg(jsonb_build_object('id',id,'nama',nama) order by nama) from public.outlet where mode='asli' and deleted_at is null),'[]'),
 'jadwal',coalesce((select jsonb_agg(jsonb_build_object('id',j.id,'outlet_id',o.id,'outlet',o.nama,'nama',u.nama,'jabatan',(select k.jabatan from public.karyawan k where k.pengguna_id=u.id and k.outlet_id=o.id and k.mode='asli' and k.deleted_at is null order by k.id limit 1),'shift',s.nama,'jam_mulai',s.jam_mulai,'jam_selesai',s.jam_selesai) order by o.nama,s.jam_mulai,u.nama)
 from public.jadwal_shift j join public.shift_outlet s on s.id=j.shift_id and s.outlet_id=j.outlet_id join public.outlet o on o.id=j.outlet_id join public.pengguna u on u.id=j.pengguna_id
 where j.tanggal=hari and j.status='terbit' and o.mode='asli' and o.deleted_at is null and u.status='aktif'),'[]'));
end $$;
revoke all on function public.jadwal_marketing_hari_ini() from public,anon;
grant execute on function public.jadwal_marketing_hari_ini() to authenticated;

-- Existing shared masters are readable by authenticated roles. Marketing-only
-- accounts get selling-price projections above, never underlying cost records.
create function marketing_internal.boleh_master_biaya() returns boolean language sql stable security definer set search_path='' as $$
 select not public.punya_peran('{marketing}') or public.punya_peran('{owner,admin_pusat,finance,hrd,admin_gudang,manajer_area,spv,kasir,barista,tablet,mitra,pic}');
$$;
revoke all on function marketing_internal.boleh_master_biaya() from public,anon;
grant execute on function marketing_internal.boleh_master_biaya() to authenticated;
do $$ declare tab text; begin
 foreach tab in array array['menu','bahan','resep','barang_titipan','isi_titipan','produsen_titipan','supplier'] loop
 execute format('create policy marketing_batas_master on public.%I as restrictive for select to authenticated using (marketing_internal.boleh_master_biaya())',tab);
 end loop;
end $$;
