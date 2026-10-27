-- Fixture gudang terisolasi, seluruh bahan/outlet/dokumen/mutasi/biaya dibatalkan.
begin;
do $$declare admin uuid;o uuid:=gen_random_uuid();b uuid:=gen_random_uuid();kid uuid;item uuid;begin
 select t.pengguna_id into admin from public.penugasan t join public.pengguna u on u.id=t.pengguna_id where t.peran='owner' and u.status='aktif' limit 1;
 if admin is null then raise exception 'Perlu owner aktif';end if;
 perform set_config('request.jwt.claim.sub',admin::text,true);
 insert into public.outlet(id,nama,kepemilikan) values(o,'Gudang revisi fixture rollback','Pusat');
 insert into public.bahan(id,nama,satuan_beli,satuan_pakai,konversi,harga_beli,harga_pokok,harga_jual_gudang) values(b,'Bahan fixture rollback','pack','g',10,1000,100,1500);
 perform public.geser_stok('asli',null,b,100,'koreksi',null,'Fixture rollback');
 insert into public.kiriman(outlet_id) values(o) returning id into kid;
 insert into public.item_kiriman(kiriman_id,bahan_id,nama,satuan,konversi,qty,harga) values(kid,b,'Bahan fixture rollback','pack',10,2,1600) returning id into item;
 perform set_config('test.gudang_outlet',o::text,true);perform set_config('test.gudang_bahan',b::text,true);perform set_config('test.gudang_kirim',kid::text,true);perform set_config('test.gudang_item',item::text,true);
end $$;
set local role authenticated;
select public.atur_harga_jual_gudang(current_setting('test.gudang_bahan')::uuid,1600,1500);
select public.atur_pemeriksa_kiriman(current_setting('test.gudang_kirim')::uuid,'Pemeriksa fixture');
select public.kirim_kiriman(current_setting('test.gudang_kirim')::uuid);
reset role;
do $$begin
 if (select hpp from gudang_internal.hpp_kiriman where item_id=current_setting('test.gudang_item')::uuid)<>1000 then raise exception 'Snapshot HPP salah';end if;
 update public.bahan set harga_pokok=200 where id=current_setting('test.gudang_bahan')::uuid;
end $$;
set local role authenticated;
select public.periksa_kiriman(current_setting('test.gudang_kirim')::uuid,gen_random_uuid(),jsonb_build_array(jsonb_build_object('id',current_setting('test.gudang_item'),'baik',1,'rusak',0,'salah',0)),'Fixture barang baik',null);
do $$declare oid uuid;d date:=(now() at time zone 'Asia/Jakarta')::date;bid uuid;r jsonb;begin
 oid:=public.proses_opname_gudang(jsonb_build_object('aksi','buat','request_id',gen_random_uuid(),'tanggal',d));
 perform public.proses_opname_gudang(jsonb_build_object('aksi','simpan','id',oid,'versi',0,'items',jsonb_build_array(jsonb_build_object('bahan_id',current_setting('test.gudang_bahan'),'fisik',78,'alasan','Selisih fixture'))));
 perform public.proses_opname_gudang(jsonb_build_object('aksi','final','id',oid,'versi',1));
 perform public.proses_opname_gudang(jsonb_build_object('aksi','final','id',oid,'versi',1));
 bid:=public.proses_biaya_gudang(jsonb_build_object('request_id',gen_random_uuid(),'tanggal',d,'jumlah',100,'keterangan','Ongkos fixture','outlet_id',current_setting('test.gudang_outlet')));
 r:=public.laporan_laba_gudang(d,d,current_setting('test.gudang_outlet')::uuid,null);
 if jsonb_array_length(r->'rows')<>1 or (r#>>'{rows,0,hpp_gudang}')::numeric<>1000 or (r#>>'{rows,0,qty}')::numeric<>1 then raise exception 'Laporan mengubah HPP atau menghitung barang belum diterima';end if;
 perform set_config('test.gudang_opname',oid::text,true);
end $$;
reset role;
do $$begin
 if (select jumlah from public.stok where mode='asli' and outlet_id is null and bahan_id=current_setting('test.gudang_bahan')::uuid)<>78 then raise exception 'Stok akhir salah';end if;
 if (select count(*) from public.mutasi_stok where ref_id=current_setting('test.gudang_opname')::uuid)<>1 then raise exception 'Opname terposting ganda';end if;
end $$;
select 'PASS: authenticated harga, pemeriksa, pengiriman, HPP terkunci, penerimaan asli, opname idempotent, biaya dan laporan; ROLLBACK' as result;
rollback;
