begin;
do $$
declare u uuid;o uuid:=gen_random_uuid();b uuid:=gen_random_uuid();k uuid;sid uuid:=gen_random_uuid();p jsonb;r uuid;s record;v jsonb;other uuid:=gen_random_uuid();staff uuid:=gen_random_uuid();
begin
 select t.pengguna_id into u from penugasan t join pengguna g on g.id=t.pengguna_id where t.peran='owner' and g.status='aktif' limit 1;
 if u is null then raise exception 'Perlu Owner aktif';end if;
 perform set_config('request.jwt.claim.sub',u::text,true);
 insert into outlet(id,nama) values(o,'Accounting fixture rollback'),(other,'Accounting outlet lain rollback');
 insert into bahan(id,nama,satuan_beli,satuan_pakai,konversi,harga_beli,harga_jual_gudang) values(b,'Bahan fixture rollback','pack','g',10,1000,1500);
 insert into sesi_kas(id,outlet_id,kasir_id,pos_tim,modal_laci,kas_harian) values(sid,o,u,true,200000,false);
 select id into k from kategori_biaya where nama='Bahan Baku';
 p:=jsonb_build_object('request_id',gen_random_uuid(),'outlet_id',o,'kategori_id',k,'jumlah',10000,'sumber','laci','sesi_id',sid,'items',jsonb_build_array(jsonb_build_object('bahan_id',b,'qty',10)));
 r:=catat_belanja_bahan(p);
 if r<>catat_belanja_bahan(p) then raise exception 'Retry belanja ganda';end if;
 if exists(select 1 from stok where outlet_id=o and jumlah<>0) then raise exception 'Stok bertambah sebelum penerimaan';end if;
 insert into auth.users(id,aud,role,email) values(staff,'authenticated','authenticated','fixture-'||staff||'@example.invalid');
 insert into pengguna(id,nama,status) values(staff,'Penerima fixture','aktif');
 insert into penugasan(pengguna_id,peran,outlet_id) values(staff,'barista',o);
 perform set_config('test.receipt',r::text,true);perform set_config('test.outlet',o::text,true);perform set_config('test.other',other::text,true);perform set_config('test.staff',staff::text,true);perform set_config('test.owner',u::text,true);perform set_config('test.sesi',sid::text,true);perform set_config('test.bahan',b::text,true);
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.staff'),true);
do $$declare r uuid:=current_setting('test.receipt')::uuid;b uuid:=current_setting('test.bahan')::uuid;p jsonb;v numeric;begin
 if (select count(*) from belanja_bahan_outlet where id=r)<>1 then raise exception 'Barista tidak bisa melihat penerimaan';end if;
 p:=jsonb_build_object('id',r,'items',jsonb_build_array(jsonb_build_object('bahan_id',b,'qty',8)),'catatan','Dua barang rusak');
 perform terima_belanja_bahan(p);perform terima_belanja_bahan(p);
 select jumlah into v from stok where bahan_id=b and outlet_id=current_setting('test.outlet')::uuid;
 if v<>8 then raise exception 'Stok harus delapan, bukan ganda';end if;
 begin perform revisi_aktual_kas(jsonb_build_object('sesi_id',current_setting('test.sesi'),'aktual',0,'sebelum',0,'alasan','Dilarang'));raise exception 'Barista merevisi kas';exception when others then if sqlerrm not like 'Hanya Accounting%' then raise;end if;end;
 begin perform rekap_titipan_rentang(current_setting('test.other')::uuid,current_date,current_date);raise exception 'Lintas outlet lolos';exception when others then if sqlerrm not like 'Tidak diizinkan%' then raise;end if;end;
end $$;
reset role;
update sesi_kas set ditutup_at=now(),fisik_akhir=300000,kas_seharusnya=350000,setoran=100000,seharusnya=150000,selisih=-50000 where id=current_setting('test.sesi')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.owner'),true);
do $$declare v jsonb;begin
 perform revisi_aktual_kas(jsonb_build_object('sesi_id',current_setting('test.sesi'),'aktual',340000,'sebelum',300000,'alasan','Hitung ulang fixture'));
 if not exists(select 1 from sesi_kas where id=current_setting('test.sesi')::uuid and setoran=140000 and selisih=-10000) then raise exception 'Revisi belum menghitung selisih';end if;
 if (select count(*) from revisi_aktual_kas where sesi_id=current_setting('test.sesi')::uuid)<>1 then raise exception 'Audit tidak ada';end if;
 v:=persediaan_bulanan(current_setting('test.outlet')::uuid,current_date);
 if (v->>'pembelian')::bigint<>10000 then raise exception 'Accounting menghitung pembelian dua kali: %',v;end if;
 if has_function_privilege('anon','public.catat_belanja_bahan(jsonb)','execute') then raise exception 'Anon bisa belanja';end if;
end $$;
rollback;
