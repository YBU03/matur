-- Run only as an administrator. Fixtures and nonactive promo are always rolled back.
begin;
do $$ declare u uuid:=gen_random_uuid(); begin
 insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values(u,'authenticated','authenticated','marketing-fixture-'||u||'@example.invalid','{}','{}',now(),now());
 insert into public.pengguna(id,nama,email,status) values(u,'Uji Marketing (ROLLBACK)','marketing-fixture-'||u||'@example.invalid','aktif') on conflict(id) do update set status='aktif';
 insert into public.penugasan(pengguna_id,peran,outlet_id) values(u,'marketing',null);
 perform set_config('request.jwt.claim.sub',u::text,true);
end $$;
set local role authenticated;
do $$ declare k jsonb;pid uuid;p jsonb;n int;begin
 k:=public.katalog_promo_marketing();
 if jsonb_array_length(k->'outlets')<2 or jsonb_array_length(k->'menus')=0 then raise exception 'Katalog tidak lengkap';end if;
 p:=jsonb_build_object('nama','UJI Marketing ROLLBACK','aktif',false,'mulai','2026-11-25','selesai','2026-11-25','jam_mulai','00:00','jam_selesai','23:59:59','semua_outlet',true,'outlet_ids','[]'::jsonb,'aturan',jsonb_build_array(jsonb_build_object('menu_id',k#>>'{menus,0,id}','varian_ids','[]'::jsonb,'jenis','persen','nilai',10)),'kuota',30,'per_menu',false,'bersama',false,'boleh_manual',false);
 pid:=public.simpan_promo(p);
 if not exists(select 1 from jsonb_array_elements(public.daftar_promo(null,true)) x where x->>'id'=pid::text and (x->>'aktif')::boolean=false) then raise exception 'Promo tidak tersimpan';end if;
 perform public.simpan_promo(p||jsonb_build_object('id',pid,'versi',1,'nama','UJI Marketing revisi ROLLBACK'));
 select count(*) into n from public.menu;if n<>0 then raise exception 'HPP menu terbuka';end if;
 select count(*) into n from public.transaksi;if n<>0 then raise exception 'Transaksi mentah terbuka';end if;
 select count(*) into n from public.jadwal_shift;if n<>0 then raise exception 'Jadwal mentah terbuka';end if;
 select count(*) into n from public.laporan_bulanan;if n<>0 then raise exception 'Laporan keuangan terbuka';end if;
end $$;
select jsonb_build_object('outlets',jsonb_array_length(public.pantau_pos_periode(null)->'outlet'),'catalog_menus',jsonb_array_length(public.katalog_promo_marketing()->'menus'),'jadwal_terbit',jsonb_array_length(public.jadwal_marketing_hari_ini()->'jadwal'),'tanggal',public.jadwal_marketing_hari_ini()->>'tanggal','raw_menu_count',(select count(*) from public.menu),'raw_jadwal_count',(select count(*) from public.jadwal_shift)) verifikasi;
rollback;
