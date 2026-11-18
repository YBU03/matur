-- Integrasi pada shift tertutup Kominot; semua perubahan pengujian selalu ROLLBACK.
begin;
set local lock_timeout='5s';
set local statement_timeout='45s';
select set_config('request.jwt.claim.sub','f1e0a66c-55f7-4f04-81b8-965d24a597ab',true);
set local role authenticated;
do $test$
declare o uuid;s uuid;m uuid;p jsonb;v jsonb;r jsonb;d jsonb;before_count int;n int;aktual bigint;stok text;tid uuid;
begin
 select id into strict o from public.outlet where nama='Ruma Kopi Kominot' and mode='asli' and deleted_at is null;
 select id,setoran into strict s,aktual from public.sesi_kas where outlet_id=o and tanggal_shift='2026-11-17' and mode='asli';
 select id into strict m from public.menu where nama='Butterscotch Latte' and aktif and mode='asli' and deleted_at is null;
 select count(*) into before_count from public.transaksi where outlet_id=o;
 p:=jsonb_build_object('request_id',gen_random_uuid(),'aksi','tambah','outlet_id',o,'sesi_id',s,'tanggal','2026-11-17','jam','21:10','kanal','langsung','metode','qris','diskon',0,'alasan','Fixture Akunting ROLLBACK','items',jsonb_build_array(jsonb_build_object('menu_id',m,'qty',1,'harga',28000,'varian_ids','[]'::jsonb)));
 v:=public.simpan_koreksi_penjualan(p||'{"pratinjau":true}');
 select count(*) into n from public.transaksi where outlet_id=o;
 if n<>before_count then raise exception 'Preview menyimpan transaksi';end if;
 p:=p||jsonb_build_object('sidik_preview',v->>'sidik_preview');r:=public.simpan_koreksi_penjualan(p);tid:=(r->>'id')::uuid;
 if r->>'id' is distinct from public.simpan_koreksi_penjualan(p)->>'id' then raise exception 'Retry menggandakan transaksi';end if;
 d:=public.rincian_koreksi_penjualan(tid);
 p:=p||jsonb_build_object('request_id',gen_random_uuid(),'aksi','edit','id',tid,'sidik',d->>'sidik','items',(select jsonb_agg(x||'{"qty":2,"harga":25000}') from jsonb_array_elements(d->'items')x));
 v:=public.simpan_koreksi_penjualan(p||'{"pratinjau":true}');r:=public.simpan_koreksi_penjualan(p||jsonb_build_object('sidik_preview',v->>'sidik_preview'));
 if (r->>'total')::bigint<>50000 then raise exception 'Edit total salah';end if;
 select md5(jsonb_agg(jsonb_build_array(st.bahan_id,st.jumlah) order by st.bahan_id)::text) into stok from public.stok st where st.outlet_id=o;
 for n in 1..2 loop
  d:=public.rincian_koreksi_penjualan(tid);p:=jsonb_build_object('request_id',gen_random_uuid(),'aksi','hapus','outlet_id',o,'id',tid,'sidik',d->>'sidik','alasan','Uji hapus; rollback');
  v:=public.simpan_koreksi_penjualan(p||'{"pratinjau":true}');perform public.simpan_koreksi_penjualan(p||jsonb_build_object('sidik_preview',v->>'sidik_preview'));
  d:=public.rincian_koreksi_penjualan(tid);p:=p||jsonb_build_object('request_id',gen_random_uuid(),'aksi','pulihkan','sidik',d->>'sidik','alasan','Uji pulihkan; rollback');
  v:=public.simpan_koreksi_penjualan(p||'{"pratinjau":true}');perform public.simpan_koreksi_penjualan(p||jsonb_build_object('sidik_preview',v->>'sidik_preview'));
 end loop;
 if (select md5(jsonb_agg(jsonb_build_array(st.bahan_id,st.jumlah) order by st.bahan_id)::text) from public.stok st where st.outlet_id=o) is distinct from stok then raise exception 'Saldo stok tidak kembali setelah hapus/pulihkan';end if;
 if (select setoran from public.sesi_kas where id=s) is distinct from aktual then raise exception 'Setoran aktual berubah';end if;
 perform set_config('sales.test','PASS: preview, tambah, retry, edit, hapus/pulihkan dua kali; setoran tetap; ROLLBACK',true);
end $test$;
select current_setting('sales.test') hasil;
rollback;
