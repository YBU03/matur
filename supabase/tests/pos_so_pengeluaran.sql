-- Fixture terisolasi. Semua data uji dan kredensial sementara di-ROLLBACK.
begin;
do $$
declare admin uuid;o uuid:=gen_random_uuid();un text:='uji-'||replace(o::text,'-','');login jsonb;uid uuid;b uuid:=gen_random_uuid();m uuid:=gen_random_uuid();
begin
 select p.pengguna_id into admin from public.penugasan p join public.pengguna u on u.id=p.pengguna_id where p.peran='owner' and u.status='aktif' limit 1;
 if admin is null then raise exception 'Perlu owner aktif untuk fixture';end if;
 insert into public.outlet(id,nama) values(o,'SO dan pengeluaran fixture rollback');
 insert into public.bahan(id,nama,satuan_beli,satuan_pakai,konversi,harga_beli,harga_jual_gudang,harga_pokok) values(b,'Bahan SO fixture','pack','g',10,1000,1500,100);
 insert into public.menu(id,nama,harga_langsung,harga_ojol) values(m,'Menu SO fixture',20000,22000);
 insert into public.resep(menu_id,bahan_id,takaran) values(m,b,1);
 perform public.geser_stok('asli',o,b,10,'koreksi',null,'Fixture rollback');
 perform set_config('request.jwt.claim.sub',admin::text,true);
 perform public.atur_akses_pos_outlet(o,un,'UjiPosOperasional-123',true);
 login:=public.masuk_pos_outlet(un,'UjiPosOperasional-123',repeat('v',64),repeat('w',48));
 select id into uid from public.pengguna where email=login->>'email';
 perform set_config('request.jwt.claim.sub',uid::text,true);
 perform set_config('test.outlet',o::text,true);perform set_config('test.bahan',b::text,true);perform set_config('test.menu',m::text,true);perform set_config('test.owner',admin::text,true);perform set_config('test.tablet',uid::text,true);
end $$;
set local role authenticated;
select public.status_pos_tim(current_setting('test.outlet')::uuid,repeat('v',64),'',false)->>'boleh' as akses_pos;
do $$
declare p jsonb;i uuid;r uuid;sid uuid; k uuid;st numeric;other uuid;d date:=(now() at time zone 'Asia/Jakarta')::date;
begin
 select id into sid from public.sesi_kas where outlet_id=current_setting('test.outlet')::uuid and ditutup_at is null;
 select id into k from public.kategori_biaya where nama='Biaya Marketing';
 p:=jsonb_build_object('outlet_id',current_setting('test.outlet'),'request_id',gen_random_uuid(),'kategori_id',k,'jumlah',10000,'sumber','laci','keterangan','Fee marketing fixture');
 i:=public.catat_pengeluaran_pos(p);r:=public.catat_pengeluaran_pos(p);
 if i<>r or (select count(*) from public.biaya_outlet where outlet_id=current_setting('test.outlet')::uuid)<>1 then raise exception 'Pengeluaran ganda';end if;
 if (select sesi_kas_id from public.biaya_outlet where id=i)<>sid then raise exception 'Sesi laci tidak tersambung';end if;
 perform public.catat_pengeluaran_pos(p||jsonb_build_object('request_id',gen_random_uuid(),'sumber','pusat','jumlah',20000));
 if (select sum(jumlah) from public.biaya_outlet where sesi_kas_id=sid and sumber='laci' and deleted_at is null)<>10000 then raise exception 'Pembayaran pusat mengurangi laci';end if;
 -- Alur edit/hapus kasir tetap tunduk pada RLS dan trigger penutupan.
 update public.biaya_outlet set jumlah=12000 where id=i;
 if not found then raise exception 'Edit kasir ditolak';end if;
 update public.biaya_outlet set deleted_at=now() where id=i;
 if not found then raise exception 'Hapus kasir ditolak';end if;
 p:=jsonb_build_object('outlet_id',current_setting('test.outlet'),'request_id',gen_random_uuid(),'tanggal',d,'items',jsonb_build_array(jsonb_build_object('bahan_id',current_setting('test.bahan'),'qty_fisik',8,'qty_sistem',10)),'catatan','SO fixture');
 i:=public.simpan_opname_terukur(p);r:=public.simpan_opname_terukur(p);
 if i<>r or (select total_nilai from public.opname where id=i)<>1200 then raise exception 'SO ganda atau nilai persediaan salah';end if;
 begin perform public.simpan_opname_terukur(p||jsonb_build_object('request_id',gen_random_uuid()));raise exception 'Stok basi tidak ditolak';exception when others then if sqlerrm not like 'Stok berubah%' then raise;end if;end;
 select id into other from public.outlet where id<>current_setting('test.outlet')::uuid limit 1;
 begin perform public.simpan_opname_terukur(p||jsonb_build_object('request_id',gen_random_uuid(),'outlet_id',other));raise exception 'Lintas outlet lolos';exception when others then if sqlerrm not like 'Tidak berwenang%' then raise;end if;end;
 i:=public.catat_produk_keluar(jsonb_build_object('outlet_id',current_setting('test.outlet'),'jenis','endorse','penerima','Penerima fixture','items',jsonb_build_array(jsonb_build_object('menu_id',current_setting('test.menu'),'qty',1))));
 select jumlah into st from public.stok where outlet_id=current_setting('test.outlet')::uuid and bahan_id=current_setting('test.bahan')::uuid;
 if st<>7 then raise exception 'Marketing tidak memotong stok resep';end if;
 perform set_config('test.marketing',i::text,true);perform set_config('test.sesi',sid::text,true);
end $$;
reset role;
-- Peran gudang dapat mengelola additional, barista hanya outletnya.
do $$declare v uuid;uid uuid:=gen_random_uuid();o uuid:=current_setting('test.outlet')::uuid;begin
 insert into auth.users(id,aud,role,email) values(uid,'authenticated','authenticated','fixture-'||uid||'@example.invalid');
 insert into public.pengguna(id,nama,status) values(uid,'Gudang fixture','aktif');
 insert into public.penugasan(pengguna_id,peran) values(uid,'admin_gudang');
 perform set_config('request.jwt.claim.sub',uid::text,true);
end $$;
set local role authenticated;
insert into public.varian(menu_id,grup,nama,tambahan_harga) values(current_setting('test.menu')::uuid,'Gula','Less Sugar fixture',0);
update public.varian set tambahan_harga=2000 where menu_id=current_setting('test.menu')::uuid;
reset role;
do $$declare uid uuid:=gen_random_uuid();begin
 insert into auth.users(id,aud,role,email) values(uid,'authenticated','authenticated','fixture-'||uid||'@example.invalid');
 insert into public.pengguna(id,nama,status) values(uid,'Barista SO fixture','aktif');
 insert into public.penugasan(pengguna_id,peran,outlet_id) values(uid,'barista',current_setting('test.outlet')::uuid);
 perform set_config('request.jwt.claim.sub',uid::text,true);
end $$;
set local role authenticated;
select public.simpan_opname_terukur(jsonb_build_object('outlet_id',current_setting('test.outlet'),'request_id',gen_random_uuid(),'tanggal',(now() at time zone 'Asia/Jakarta')::date,'catatan','SO barista fixture','items',jsonb_build_array(jsonb_build_object('bahan_id',current_setting('test.bahan'),'qty_fisik',7,'qty_sistem',7))));
do $$begin
 if not exists(select 1 from public.opname o join public.item_opname i on i.opname_id=o.id where o.outlet_id=current_setting('test.outlet')::uuid) then raise exception 'Riwayat SO tidak dapat dibaca barista';end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',current_setting('test.owner'),true);
set local role authenticated;
do $$declare r jsonb;begin
 r:=public.persediaan_bulanan(current_setting('test.outlet')::uuid,(now() at time zone 'Asia/Jakarta')::date);
 if (r->>'akhir')::numeric<>1050 or r->>'sumber_akhir'<>'opname bulan ini' then raise exception 'Nilai SO tidak tersambung ke Akunting';end if;
end $$;
select public.ringkasan_kas_tim(current_setting('test.sesi')::uuid) is not null as rekap_kas_tersedia;
select 'PASS: SO tablet/barista, nilai stok, marketing, edit/hapus biaya, additional Gudang, retry dan batas outlet; ROLLBACK' as result;
rollback;
