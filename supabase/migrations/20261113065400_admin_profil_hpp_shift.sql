-- Admin profile editing: private helper, unchanged employee self-service and private bucket.
create schema if not exists pengguna_internal;
revoke all on schema pengguna_internal from public,anon;
grant usage on schema pengguna_internal to authenticated;
create function pengguna_internal.boleh_edit(uid uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select auth.uid() is not null and punya_peran('{owner,admin_pusat}')
 and exists(select 1 from pengguna where id=uid and status<>'dihapus' and not akun_tablet)
 and (punya_peran('{owner}') or not exists(select 1 from penugasan where pengguna_id=uid and peran='owner'))
$$;
revoke all on function pengguna_internal.boleh_edit(uuid) from public,anon;
grant execute on function pengguna_internal.boleh_edit(uuid) to authenticated;
create policy profil_unggah_admin on storage.objects for insert to authenticated
 with check(bucket_id='profil' and pengguna_internal.boleh_edit(((storage.foldername(name))[1])::uuid));
create function pengguna_internal.simpan_profil(uid uuid,sebelum jsonb,p jsonb) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare lama jsonb; prof profil_karyawan; foto text:=nullif(p->>'foto_path','');
begin
 if not pengguna_internal.boleh_edit(uid) then raise exception 'Anda tidak dapat mengedit profil ini';end if;
 perform 1 from pengguna where id=uid for update;
 select jsonb_build_object('nama',nama,'no_hp',no_hp) into lama from pengguna where id=uid;
 if lama is distinct from sebelum then raise exception 'Data sudah berubah. Muat ulang sebelum menyimpan';end if;
 if coalesce(trim(p->>'nama'),'')='' or length(p->>'nama')>120 or length(p->>'no_hp')>30
 or length(p->>'alamat_ktp')>2000 or length(p->>'alamat_domisili')>2000 then raise exception 'Nama/HP/alamat tidak valid';end if;
 if foto is not null and (split_part(foto,'/',1)<>uid::text or not exists(select 1 from storage.objects where bucket_id='profil' and name=foto)) then raise exception 'Foto tidak valid';end if;
 insert into profil_karyawan(pengguna_id) values(uid) on conflict do nothing;
 select * into prof from profil_karyawan where pengguna_id=uid for update;
 update pengguna set nama=trim(p->>'nama'),no_hp=nullif(trim(p->>'no_hp'),'') where id=uid;
 update profil_karyawan set foto_path=coalesce(foto,prof.foto_path),alamat_ktp=nullif(trim(p->>'alamat_ktp'),''),alamat_domisili=nullif(trim(p->>'alamat_domisili'),''),updated_at=now() where pengguna_id=uid;
 insert into log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_lama,nilai_baru)
 values(auth.uid(),'edit_profil_admin','pengguna',uid::text,lama||jsonb_build_object('foto_path',prof.foto_path,'alamat_ktp',prof.alamat_ktp,'alamat_domisili',prof.alamat_domisili),p);
end $$;
revoke all on function pengguna_internal.simpan_profil(uuid,jsonb,jsonb) from public,anon;
grant execute on function pengguna_internal.simpan_profil(uuid,jsonb,jsonb) to authenticated;
create function public.edit_profil_admin(uid uuid,sebelum jsonb,p jsonb) returns void
language sql security invoker set search_path='' as $$select pengguna_internal.simpan_profil(uid,sebelum,p)$$;
revoke all on function public.edit_profil_admin(uuid,jsonb,jsonb) from public,anon;
grant execute on function public.edit_profil_admin(uuid,jsonb,jsonb) to authenticated;

-- Finance can edit cost only, without gaining general menu/price administration.
create function menu_internal.atur_hpp_titipan(uid uuid,sebelum numeric,nilai numeric) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare m menu; bid uuid; qty numeric;
begin
 if auth.uid() is null or not punya_peran('{owner,admin_pusat,finance,hrd,admin_gudang}') then raise exception 'Tidak berwenang mengedit HPP';end if;
 if nilai is null or nilai<0 or nilai>100000000 or nilai<>round(nilai) then raise exception 'HPP wajib rupiah bulat 0 sampai 100 juta';end if;
 select * into m from menu where id=uid and mode='asli' and deleted_at is null and titipan for update;
 if m.id is null then raise exception 'Produk titipan tidak ditemukan';end if;
 if m.harga_titip is distinct from sebelum then raise exception 'HPP sudah berubah. Muat ulang sebelum menyimpan';end if;
 -- A single dedicated item (one cheesecake per portion) has one cost source.
 if exists(select 1 from isi_titipan where menu_id=m.id) then
   if (select count(*) from isi_titipan where menu_id=m.id)<>1 then raise exception 'Menu berisi beberapa barang. Edit harga komponennya melalui Titipan Produk';end if;
   select barang_id,i.qty into bid,qty from isi_titipan i where menu_id=m.id;
   if qty<>1 or exists(select 1 from isi_titipan where barang_id=bid and menu_id<>m.id) then raise exception 'Barang dipakai beberapa porsi/menu. Edit harga satuan melalui Titipan Produk';end if;
   perform 1 from barang_titipan where id=bid for update;
   update barang_titipan set harga=nilai,updated_at=now() where id=bid;
 end if;
 update menu set harga_titip=nilai where id=m.id;
 insert into log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_lama,nilai_baru) values(auth.uid(),'edit_hpp_titipan','menu',m.id::text,jsonb_build_object('harga_titip',m.harga_titip),jsonb_build_object('harga_titip',nilai));
end $$;
revoke all on function menu_internal.atur_hpp_titipan(uuid,numeric,numeric) from public,anon;
grant execute on function menu_internal.atur_hpp_titipan(uuid,numeric,numeric) to authenticated;
create function public.edit_hpp_titipan(uid uuid,sebelum numeric,nilai numeric) returns void
language sql security invoker set search_path='' as $$select menu_internal.atur_hpp_titipan(uid,sebelum,nilai)$$;
revoke all on function public.edit_hpp_titipan(uuid,numeric,numeric) from public,anon;
grant execute on function public.edit_hpp_titipan(uuid,numeric,numeric) to authenticated;
do $$declare d text;begin
 d:=pg_get_functiondef('menu_internal.atur_resep(jsonb)'::regprocedure);
 if position('{owner,admin_pusat,admin_gudang,hrd}' in d)=0 then raise exception 'Periksa izin resep terbaru';end if;
 execute replace(d,'{owner,admin_pusat,admin_gudang,hrd}','{owner,admin_pusat,admin_gudang,hrd,finance}');
end $$;

-- Read-only report also serves normal POS closure, not only optional Alur Shift.
do $$declare d text;begin
 d:=pg_get_functiondef('pos_kas_internal.laporan_shift(uuid,text,uuid)'::regprocedure);
 if position('and not matur_internal.admin_pos_outlet(o)' in d)=0 then raise exception 'Periksa izin laporan shift terbaru';end if;
 d:=replace(d,'and not matur_internal.admin_pos_outlet(o)', 'and not matur_internal.admin_pos_outlet(o) and not (public.peran_di_outlet(o,''{kasir,barista,spv}'') and public.boleh_outlet(o))');
 d:=replace(d,'''kas'',h,', $q$'pembayaran',coalesce((select jsonb_object_agg(label,total) from (
 select case when t.kanal::text not in ('langsung','tumbler','offline','dine_in','takeaway') then t.kanal::text else p.metode::text end label,sum(p.nominal) total
 from public.pembayaran p join public.transaksi t on t.id=p.transaksi_id
 where t.sesi_kas_id=sid and t.status='lunas' and p.metode::text<>'tunai'
 group by 1) pay),'{}'::jsonb),'kas',h,$q$);
 execute d;
end $$;
