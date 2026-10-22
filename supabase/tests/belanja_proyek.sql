-- Seluruh fixture sementara, tidak menyentuh transaksi proyek asli.
begin;
do $$
declare a uuid:=gen_random_uuid();m uuid:=gen_random_uuid();x uuid:=gen_random_uuid();o uuid:=gen_random_uuid();o2 uuid:=gen_random_uuid();p uuid:=gen_random_uuid();r uuid:=gen_random_uuid();b uuid:=gen_random_uuid();
begin
 insert into auth.users(id,email) values(a,a::text||'@test.invalid'),(m,m::text||'@test.invalid'),(x,x::text||'@test.invalid');
 insert into public.pengguna(id,nama,email,status) values(a,'Admin Belanja Test',a::text||'@test.invalid','aktif'),(m,'Mitra Belanja Test',m::text||'@test.invalid','aktif'),(x,'Luar Proyek Test',x::text||'@test.invalid','aktif');
 insert into public.outlet(id,nama) values(o,'Belanja Test'),(o2,'Belanja Other Test');
 insert into public.penugasan(pengguna_id,peran,outlet_id) values(a,'admin_pusat',null),(m,'mitra',o),(x,'mitra',o2);
 insert into public.proyek(id,outlet_id,nama) values(p,o,'Belanja Test');
 insert into public.item_rab(id,proyek_id,nama,kategori,qty,harga_estimasi,harga_realisasi,satuan) values(r,p,'Semen Test','Material',2,30000,0,'sak');
 perform set_config('test.admin',a::text,true);perform set_config('test.mitra',m::text,true);perform set_config('test.luar',x::text,true);perform set_config('test.proyek',p::text,true);perform set_config('test.rab',r::text,true);perform set_config('test.nota',b::text,true);
 perform set_config('test.path',p::text||'/belanja/'||b::text||'/'||gen_random_uuid()::text||'.pdf',true);
 perform set_config('request.jwt.claim.sub',a::text,true);
end $$;
set local role authenticated;
do $$
declare p uuid:=current_setting('test.proyek')::uuid;b uuid:=current_setting('test.nota')::uuid;r uuid:=current_setting('test.rab')::uuid;v timestamptz;payid uuid:=gen_random_uuid();n int;
begin
 insert into storage.objects(bucket_id,name) values('proyek',current_setting('test.path'));
 perform public.simpan_belanja_proyek(b,p,null,jsonb_build_object('tanggal','2026-10-22','toko','Toko Test','penanggung_jawab','PJ Test','nota_path',current_setting('test.path'),'items',jsonb_build_array(jsonb_build_object('item_rab_id',r,'qty','2','harga_satuan','10000'),jsonb_build_object('nama','Ongkir Test','qty','1','harga_satuan','5000','kategori','Transport'))));
 select updated_at into v from public.belanja_proyek where id=b;
 perform public.bayar_belanja_proyek(payid,b,v,'{"tanggal":"2026-10-22","jumlah":"10000","sumber":"dana_proyek","metode":"transfer"}'::jsonb);
 perform public.bayar_belanja_proyek(payid,b,v,'{"tanggal":"2026-10-22","jumlah":"10000","sumber":"dana_proyek","metode":"transfer"}'::jsonb);
 select count(*) into n from public.belanja_proyek_bayar where belanja_id=b;if n<>1 then raise exception 'Pembayaran duplikat';end if;
 if (select total from public.belanja_proyek where id=b)<>25000 then raise exception 'Total nota salah';end if;
 if (select harga_realisasi from public.item_rab where id=r)<>0 then raise exception 'Baseline RAB diubah';end if;
 begin
  update public.belanja_proyek set total=1 where id=b;
  raise exception 'Direct write diizinkan';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('test.mitra'),true);
set local role authenticated;
do $$
declare n int;
begin
 select count(*) into n from public.belanja_proyek where id=current_setting('test.nota')::uuid;if n<>1 then raise exception 'Mitra tidak bisa membaca nota sendiri';end if;
 select count(*) into n from storage.objects where bucket_id='proyek' and name=current_setting('test.path');if n<>1 then raise exception 'Bukti nota tidak terbaca';end if;
 begin
  perform public.batalkan_belanja_proyek(current_setting('test.nota')::uuid,now(),'Uji salah izin');raise exception 'Mitra dapat menulis';
 exception when others then if sqlerrm not like 'Hanya Owner/Admin Pusat%' then raise;end if;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('test.luar'),true);
set local role authenticated;
do $$
declare n int;
begin
 select count(*) into n from public.belanja_proyek where id=current_setting('test.nota')::uuid;if n<>0 then raise exception 'Nota bocor lintas outlet';end if;
 select count(*) into n from public.belanja_proyek_item where belanja_id=current_setting('test.nota')::uuid;if n<>0 then raise exception 'Item bocor';end if;
 select count(*) into n from public.belanja_proyek_bayar where belanja_id=current_setting('test.nota')::uuid;if n<>0 then raise exception 'Pembayaran bocor';end if;
 select count(*) into n from storage.objects where bucket_id='proyek' and name=current_setting('test.path');if n<>0 then raise exception 'Bukti bocor';end if;
end $$;
reset role;
select 'PASS: nota campuran, pembayaran idempoten, baseline RAB tetap, direct write ditolak, RLS dan bukti private sesuai outlet; rollback' as hasil;
rollback;
