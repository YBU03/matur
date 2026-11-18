-- Jalur tablet authenticated, harga server, kuota, retry dan void. Fixture selalu ROLLBACK.
begin;
do $$
declare admin uuid; o uuid:=gen_random_uuid(); m uuid:=gen_random_uuid();m2 uuid:=gen_random_uuid(); pid uuid; login jsonb; uid uuid; un text:='promo-uji-'||replace(o::text,'-','');
begin
 select p.pengguna_id into admin from public.penugasan p join public.pengguna u on u.id=p.pengguna_id where p.peran='owner' and u.status='aktif' limit 1;
 if admin is null then raise exception 'Perlu owner aktif untuk fixture'; end if;
 insert into public.outlet(id,nama) values(o,'Promo fixture rollback');
 insert into public.menu(id,nama,harga_langsung,harga_ojol) values(m,'Promo fixture rollback',20000,20000);
 insert into public.menu(id,nama,harga_langsung,harga_ojol) values(m2,'Caramel voucher fixture',28000,28000);
 perform set_config('request.jwt.claim.sub',admin::text,true);
 pid:=public.simpan_promo(jsonb_build_object('nama','Promo fixture rollback','aktif',true,'cakupan','transaksi','nilai_voucher',15000,'minimum_belanja',15001,'mulai',(now() at time zone 'Asia/Jakarta')::date,'selesai',(now() at time zone 'Asia/Jakarta')::date,'jam_mulai','00:00','jam_selesai','23:59:59','semua_outlet',false,'outlet_ids',jsonb_build_array(o),'aturan',jsonb_build_array(jsonb_build_object('menu_id',m,'varian_ids','[]'::jsonb,'jenis','potongan','nilai',15000),jsonb_build_object('menu_id',m2,'varian_ids','[]'::jsonb,'jenis','potongan','nilai',15000)),'kuota',1));
 perform public.atur_akses_pos_outlet(o,un,'UjiPromo-2026-123',true);
 login:=public.masuk_pos_outlet(un,'UjiPromo-2026-123',repeat('p',64),repeat('q',48));
 select id into uid from public.pengguna where email=login->>'email';
 if uid is null then raise exception 'Login fixture gagal'; end if;
 perform set_config('request.jwt.claim.sub',uid::text,true);
 perform set_config('test.outlet',o::text,true);perform set_config('test.menu',m::text,true);perform set_config('test.menu2',m2::text,true);perform set_config('test.promo',pid::text,true);perform set_config('test.admin',admin::text,true);
end $$;
set local role authenticated;
do $$
declare st jsonb; p jsonb; quote jsonb; paid jsonb; retry jsonb; failed boolean:=false; o uuid:=current_setting('test.outlet')::uuid;
begin
 st:=public.status_pos_tim(o,repeat('p',64),'',false);
 if not (st->>'boleh')::boolean then raise exception 'POS fixture tidak siap'; end if;
 p:=jsonb_build_object('request_id',gen_random_uuid(),'promo_id',current_setting('test.promo')::uuid,'outlet_id',o,'sesi_id',(st#>>'{sesi,id}')::uuid,'izin_id',(st#>>'{izin,id}')::uuid,'device_token',repeat('p',64),'pos_token',repeat('p',64),'kanal','langsung','diskon',0,'items',jsonb_build_array(jsonb_build_object('menu_id',current_setting('test.menu')::uuid,'varian_ids','[]'::jsonb,'qty',1),jsonb_build_object('menu_id',current_setting('test.menu2')::uuid,'varian_ids','[]'::jsonb,'qty',1)));
 quote:=public.pesan_promo(p);
 if (quote->>'diskon')::bigint<>15000 or public.pesan_promo(p)<>quote then raise exception 'Harga/retry reservasi salah'; end if;
 begin perform public.pesan_promo(p||jsonb_build_object('request_id',gen_random_uuid())); exception when others then if sqlerrm like '%Kuota%' then failed:=true; else raise; end if; end;
 if not failed then raise exception 'Kuota ganda lolos'; end if;
 p:=p||jsonb_build_object('client_id',gen_random_uuid(),'promo_quote',quote->>'id','metode','tunai','waktu_asli',clock_timestamp());
 paid:=public.buat_transaksi(p); retry:=public.buat_transaksi(p);
 if paid->>'id' is distinct from retry->>'id' or (paid->>'total')::bigint<>33000 or (paid->>'diskon')::bigint<>15000 then raise exception 'Checkout/retry salah'; end if;
 perform public.void_pos_langsung(o,repeat('p',64),(paid->>'id')::uuid,'salah_input','Uji promo rollback','Penguji');
 quote:=public.pesan_promo(p||jsonb_build_object('request_id',gen_random_uuid()));
 if quote->'sisa'<>jsonb_build_object('semua',0) then raise exception 'Kuota void tidak kembali'; end if;
 perform public.lepas_promo((quote->>'id')::uuid);
 perform set_config('test.transaksi',paid->>'id',true);
end $$;
reset role;
do $$
begin
 if (select count(*) from public.transaksi where outlet_id=current_setting('test.outlet')::uuid)<>1 then raise exception 'Transaksi ganda'; end if;
 if (select promo_snapshot->>'nama' from public.transaksi where id=current_setting('test.transaksi')::uuid)<>'Promo fixture rollback' then raise exception 'Snapshot hilang'; end if;
 perform set_config('request.jwt.claim.sub',current_setting('test.admin'),true);
 if jsonb_array_length(public.laporan_promo(current_setting('test.outlet')::uuid,public.tgl_op(now()),public.tgl_op(now())))<>1 then raise exception 'Laporan hilang'; end if;
end $$;
select 'PASS: voucher Rp15000 once; Rp48000 → Rp33000; quota/retry/void/report; ROLLBACK' result;
rollback;
