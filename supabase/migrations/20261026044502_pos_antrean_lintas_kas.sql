-- Saat beberapa perangkat digunakan, kas dapat ditutup ketika perangkat lain offline.
-- Penjualan sesudah waktu tutup masuk kas terbuka berikutnya; ID/harga asli tetap.
do $$ declare d text;old text;begin
 d:=pg_get_functiondef('pos_kas_internal.checkout_langsung(jsonb)'::regprocedure);
 old:='t.outlet_id<>o or t.sesi_kas_id<>sid or t.pos_payload_hash is distinct from h';
 if position(old in d)=0 then raise exception 'Guard idempotensi berubah';end if;
 -- Hash mencakup sesi asli dalam payload, sehingga penggantian sesi tetap terdeteksi.
 d:=replace(d,old,'t.outlet_id<>o or t.pos_payload_hash is distinct from h');
 old:='if s.ditutup_at is not null and w>s.ditutup_at then raise exception ''Waktu transaksi setelah kas ditutup'';end if;';
 if position(old in d)=0 then raise exception 'Guard antrean kas berubah';end if;
 d:=replace(d,old,$patch$
  if s.ditutup_at is not null and w>s.ditutup_at then
   hasil:=pos_kas_internal.siapkan_langsung(o,p->>'device_token',p->>'pos_token');
   sid:=(hasil#>>'{sesi,id}')::uuid;
   insert into public.log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_baru) values(auth.uid(),'sinkron_pos_ke_kas_baru','transaksi',client::text,jsonb_build_object('kas_asal',s.id,'kas_tujuan',sid,'waktu_asli',w));
   select * into s from public.sesi_kas where id=sid for update;
   p:=jsonb_set(p,'{sesi_id}',to_jsonb(sid));
  end if;
$patch$);execute d;
end $$;
