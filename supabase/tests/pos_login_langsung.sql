-- Fixture terisolasi; tidak mengubah kas/outlet asli. Selalu ROLLBACK.
begin;
do $$
declare admin uuid;o uuid:=gen_random_uuid();un text:='uji-'||replace(o::text,'-','');login jsonb;uid uuid;
begin
 select p.pengguna_id into admin from public.penugasan p join public.pengguna u on u.id=p.pengguna_id where p.peran='owner' and u.status='aktif' limit 1;
 if admin is null then raise exception 'Perlu owner aktif untuk fixture';end if;
 insert into public.outlet(id,nama) values(o,'POS langsung fixture rollback');
 perform set_config('request.jwt.claim.sub',admin::text,true);
 perform public.atur_akses_pos_outlet(o,un,'UjiPosLangsung-123',true);
 login:=public.masuk_pos_outlet(un,'UjiPosLangsung-123',repeat('v',64),repeat('w',48));
 if login->>'email' is null then raise exception 'Login gagal';end if;
 select id into uid from public.pengguna where email=login->>'email';
 perform set_config('request.jwt.claim.sub',uid::text,true);
 perform set_config('test.outlet',o::text,true);
end $$;
set local role authenticated;
select public.status_pos_tim(current_setting('test.outlet')::uuid,repeat('v',64),'',false)->>'boleh' as login_langsung_tanpa_jadwal_absensi;
select public.atur_modal_pos((public.status_pos_tim(current_setting('test.outlet')::uuid,repeat('v',64),'',false)#>>'{sesi,id}')::uuid,repeat('v',64),100000);
select public.tutup_kas_outlet((public.status_pos_tim(current_setting('test.outlet')::uuid,repeat('v',64),'',false)#>>'{sesi,id}')::uuid,repeat('v',64),'','',100000,'Fixture tutup kas',array[]::uuid[]);
select public.status_pos_tim(current_setting('test.outlet')::uuid,repeat('v',64),'',false)->>'boleh' as langsung_lanjut_setelah_tutup;
reset role;
do $$begin
 if (select count(*) from public.sesi_kas where outlet_id=current_setting('test.outlet')::uuid)<>2 then raise exception 'Jumlah kas tidak sesuai';end if;
 if (select count(*) from public.sesi_kas where outlet_id=current_setting('test.outlet')::uuid and ditutup_at is null)<>1 then raise exception 'Duplikasi kas terbuka';end if;
 if exists(select 1 from public.absensi where outlet_id=current_setting('test.outlet')::uuid) then raise exception 'Absensi palsu';end if;
end $$;
select 'PASS: authenticated login langsung, modal opsional, tutup dan lanjut tanpa jadwal/PIC; ROLLBACK' as result;
rollback;
