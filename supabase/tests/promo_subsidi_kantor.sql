-- Isolated authenticated POS + Accounting integration; always ROLLBACK.
begin;
do $$
declare admin uuid;o uuid:=gen_random_uuid();m uuid:=gen_random_uuid();pid uuid;login jsonb;uid uuid;un text:='subsidi-uji-'||replace(o::text,'-','');
begin
 select p.pengguna_id into admin from public.penugasan p join public.pengguna u on u.id=p.pengguna_id where p.peran='owner' and u.status='aktif' limit 1;
 if admin is null then raise exception 'Perlu owner fixture';end if;
 insert into public.outlet(id,nama) values(o,'Subsidi fixture rollback');insert into public.menu(id,nama,harga_langsung,harga_ojol) values(m,'Subsidi fixture rollback',10000,12000);
 perform set_config('request.jwt.claim.sub',admin::text,true);
 pid:=public.simpan_promo(jsonb_build_object('nama','Opening fixture','subsidi',true,'nama_subsidi','Marketing fixture','aktif',true,'mulai',(now() at time zone 'Asia/Jakarta')::date,'selesai',(now() at time zone 'Asia/Jakarta')::date,'jam_mulai','00:00','jam_selesai','23:59:59','semua_outlet',false,'outlet_ids',jsonb_build_array(o),'aturan',jsonb_build_array(jsonb_build_object('menu_id',m,'varian_ids','[]'::jsonb,'jenis','gratis','nilai',100)),'kuota',2));
 perform public.atur_akses_pos_outlet(o,un,'UjiSubsidi-2026-123',true);login:=public.masuk_pos_outlet(un,'UjiSubsidi-2026-123',repeat('s',64),repeat('q',48));select id into uid from public.pengguna where email=login->>'email';
 if uid is null then raise exception 'Login fixture gagal';end if;
 perform set_config('request.jwt.claim.sub',uid::text,true);perform set_config('test.outlet',o::text,true);perform set_config('test.menu',m::text,true);perform set_config('test.promo',pid::text,true);perform set_config('test.admin',admin::text,true);perform set_config('test.cash',uid::text,true);
end $$;
set local role authenticated;
do $$
declare st jsonb;p jsonb;q jsonb;paid jsonb;ledger jsonb;tid uuid;file text;pay jsonb;entry uuid;marketing jsonb;
begin
 st:=public.status_pos_tim(current_setting('test.outlet')::uuid,repeat('s',64),'',false);
 p:=jsonb_build_object('request_id',gen_random_uuid(),'promo_id',current_setting('test.promo')::uuid,'outlet_id',current_setting('test.outlet')::uuid,'sesi_id',(st#>>'{sesi,id}')::uuid,'izin_id',(st#>>'{izin,id}')::uuid,'device_token',repeat('s',64),'pos_token',repeat('s',64),'kanal','langsung','diskon',0,'items',jsonb_build_array(jsonb_build_object('menu_id',current_setting('test.menu')::uuid,'varian_ids','[]'::jsonb,'qty',1)));
 q:=public.pesan_promo(p);if (q->>'diskon')::bigint<>10000 or not (q->>'subsidi')::boolean then raise exception 'Subsidi quote salah';end if;
 p:=p||jsonb_build_object('client_id',gen_random_uuid(),'promo_quote',q->>'id','metode','tunai','diterima',0,'waktu_asli',clock_timestamp());paid:=public.buat_transaksi(p);
 if (paid->>'total')::bigint<>0 or paid->>'id' is distinct from (public.buat_transaksi(p)->>'id') then raise exception 'Zero/retry salah';end if;
 perform set_config('test.transaksi',paid->>'id',true);
 perform set_config('request.jwt.claim.sub',current_setting('test.admin'),true);
 ledger:=public.laporan_subsidi(current_setting('test.outlet')::uuid,public.tgl_op(now()),public.tgl_op(now()));tid:=(ledger#>>'{0,id}')::uuid;
 if jsonb_array_length(ledger)<>1 or (ledger#>>'{0,target}')::bigint<>10000 or (ledger#>>'{0,terbayar}')::bigint<>0 then raise exception 'Tagihan awal salah';end if;
 perform public.edit_tagihan_subsidi(jsonb_build_object('id',tid,'versi',1,'nama','Subsidi revisi','nominal',9000,'alasan','Uji koreksi fixture'));
 file:=current_setting('test.admin')||'/'||gen_random_uuid()::text||'.pdf';insert into storage.objects(bucket_id,name) values('subsidi-bukti',file);
 pay:=jsonb_build_object('id',tid,'versi',2,'request_id',gen_random_uuid(),'jumlah',9000,'tanggal',(now() at time zone 'Asia/Jakarta')::date,'bukti',file,'catatan','Pembayaran fixture');entry:=public.bayar_tagihan_subsidi(pay);
 if public.bayar_tagihan_subsidi(pay)<>entry then raise exception 'Pembayaran ganda';end if;
 marketing:=public.laporan_marketing_diskon(current_setting('test.outlet')::uuid,public.tgl_op(now()),public.tgl_op(now()));if (marketing#>>'{0,subsidi}')::bigint<>10000 then raise exception 'Marketing tidak sesuai harga awal';end if;
 perform set_config('request.jwt.claim.sub',current_setting('test.cash'),true);perform public.void_pos_langsung(current_setting('test.outlet')::uuid,repeat('s',64),(paid->>'id')::uuid,'salah_input','Uji subsidi rollback','Penguji');
 perform set_config('request.jwt.claim.sub',current_setting('test.admin'),true);ledger:=public.laporan_subsidi(current_setting('test.outlet')::uuid,public.tgl_op(now()),public.tgl_op(now()));
 if (ledger#>>'{0,target}')::bigint<>0 or (ledger#>>'{0,terbayar}')::bigint<>9000 then raise exception 'Void menghapus jejak uang';end if;
 perform public.bayar_tagihan_subsidi(pay||jsonb_build_object('versi',3,'request_id',gen_random_uuid(),'jumlah',-9000,'catatan','Pengembalian fixture'));
 ledger:=public.laporan_subsidi(current_setting('test.outlet')::uuid,public.tgl_op(now()),public.tgl_op(now()));if (ledger#>>'{0,terbayar}')::bigint<>0 then raise exception 'Pengembalian salah';end if;
end $$;
reset role;
do $$begin
 if (select count(*) from public.transaksi where outlet_id=current_setting('test.outlet')::uuid)<>1 then raise exception 'Penjualan ganda dari pelunasan';end if;
 if exists(select 1 from public.pembayaran where transaksi_id=current_setting('test.transaksi')::uuid) then raise exception 'Pembayaran pelanggan palsu';end if;
 if (select count(*) from promo_internal.pelunasan where tagihan_id in(select id from promo_internal.tagihan where transaksi_id=current_setting('test.transaksi')::uuid))<>2 then raise exception 'Catatan pembayaran ganda';end if;
end $$;
select 'PASS: authenticated free POS → receivable → edit → proof RLS → office payment/retry → marketing → void → refund; ROLLBACK' result;
rollback;
