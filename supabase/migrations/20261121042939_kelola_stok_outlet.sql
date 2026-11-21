create schema stok_outlet_internal;
revoke all on schema stok_outlet_internal from public,anon,authenticated;
grant usage on schema stok_outlet_internal to authenticated;
create function stok_outlet_internal.pusat() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.pengguna where id=auth.uid() and status='aktif') and public.punya_peran('{owner,admin_pusat,admin_gudang}')
$$;
create function stok_outlet_internal.lihat(o uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.pengguna where id=auth.uid() and status='aktif') and
 (stok_outlet_internal.pusat() or (public.punya_peran('{finance,hrd,spv,manajer_area}') and public.boleh_outlet(o)))
$$;
create function stok_outlet_internal.kelola(o uuid) returns boolean language sql stable security definer set search_path='' as $$
 select stok_outlet_internal.lihat(o) and (stok_outlet_internal.pusat() or public.peran_di_outlet(o,'{spv}'))
$$;
create table public.setelan_stok_outlet(
 id uuid not null unique default gen_random_uuid(),outlet_id uuid not null references public.outlet,bahan_id uuid not null references public.bahan,
 aktif boolean not null default true,minimum numeric not null check(minimum>=0 and minimum<=1000000000),
 alasan text not null,diubah_oleh uuid not null references public.pengguna,diubah_at timestamptz not null default now(),primary key(outlet_id,bahan_id)
);
create index setelan_stok_bahan_idx on public.setelan_stok_outlet(bahan_id);
create index setelan_stok_petugas_idx on public.setelan_stok_outlet(diubah_oleh);
create table public.permintaan_stok_outlet(
 id uuid primary key, outlet_id uuid not null references public.outlet,items jsonb not null,catatan text not null,
 status text not null default 'diminta' check(status in('diminta','diproses','batal')),kiriman_id uuid references public.kiriman,
 oleh uuid not null references public.pengguna,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index permintaan_stok_outlet_idx on public.permintaan_stok_outlet(outlet_id,created_at desc);
create index permintaan_stok_oleh_idx on public.permintaan_stok_outlet(oleh);
create index permintaan_stok_kiriman_idx on public.permintaan_stok_outlet(kiriman_id);
create table public.transfer_stok_terima(
 id uuid primary key,asal uuid not null references public.outlet,tujuan uuid not null references public.outlet,items jsonb not null,
 status text not null default 'menunggu' check(status in('menunggu','diterima','batal')),catatan text not null,
 oleh uuid not null references public.pengguna,created_at timestamptz not null default now(),
 diputus_oleh uuid references public.pengguna,diputus_at timestamptz,alasan text,check(asal<>tujuan)
);
create index transfer_stok_asal_idx on public.transfer_stok_terima(asal,created_at desc);
create index transfer_stok_tujuan_idx on public.transfer_stok_terima(tujuan,created_at desc);
create index transfer_stok_oleh_idx on public.transfer_stok_terima(oleh);
create index transfer_stok_putus_idx on public.transfer_stok_terima(diputus_oleh);
-- Idempotency records contain results only, never accessible as an anonymous/public write surface.
create table stok_outlet_internal.perintah(id uuid primary key,pengguna uuid not null references public.pengguna,payload jsonb not null,hasil jsonb not null,created_at timestamptz not null default now());
alter table stok_outlet_internal.perintah enable row level security;
create policy hanya_petugas on stok_outlet_internal.perintah for select to authenticated using(pengguna=auth.uid());
create index stok_perintah_pengaturan_idx on stok_outlet_internal.perintah((payload->>'outlet_id'),created_at desc) where payload->>'aksi'='setelan';
create index stok_perintah_petugas_idx on stok_outlet_internal.perintah(pengguna);
alter table public.setelan_stok_outlet enable row level security;
alter table public.permintaan_stok_outlet enable row level security;
alter table public.transfer_stok_terima enable row level security;
create policy baca on public.setelan_stok_outlet for select to authenticated using(stok_outlet_internal.lihat(outlet_id) or (auth.uid() is not null and exists(select 1 from public.pengguna where id=auth.uid() and status='aktif') and public.peran_di_outlet(outlet_id,'{kasir,barista,tablet}')));
create policy baca on public.permintaan_stok_outlet for select to authenticated using(stok_outlet_internal.lihat(outlet_id));
create policy baca on public.transfer_stok_terima for select to authenticated using(stok_outlet_internal.lihat(asal) or stok_outlet_internal.lihat(tujuan));
revoke all on public.setelan_stok_outlet,public.permintaan_stok_outlet,public.transfer_stok_terima from anon,authenticated;
grant select on public.setelan_stok_outlet,public.permintaan_stok_outlet,public.transfer_stok_terima to authenticated;
create trigger audit_setelan_stok after insert or update on public.setelan_stok_outlet for each row execute function public.catat_log();
create trigger audit_permintaan_stok after insert or update on public.permintaan_stok_outlet for each row execute function public.catat_log();
create trigger audit_transfer_terima after insert or update on public.transfer_stok_terima for each row execute function public.catat_log();
create index if not exists mutasi_outlet_waktu_idx on public.mutasi_stok(outlet_id,created_at,bahan_id) where mode='asli';

create function stok_outlet_internal.perintah(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare req uuid:=(p->>'request_id')::uuid;op text:=p->>'aksi';o uuid:=nullif(p->>'outlet_id','')::uuid;b uuid:=nullif(p->>'bahan_id','')::uuid;
 als text:=trim(p->>'alasan');q numeric;lama numeric;v jsonb;it jsonb;seen uuid[]:='{}';bid uuid;arr jsonb:='[]';r jsonb;
 x public.permintaan_stok_outlet;tr public.transfer_stok_terima;kid uuid;ke uuid;bn public.bahan;photo text:=coalesce(p->>'foto','');
begin
 if auth.uid() is null or not exists(select 1 from public.pengguna where id=auth.uid() and status='aktif') then raise exception 'Silakan login kembali';end if;
 if octet_length(p::text)>50000 or req is null or length(coalesce(als,''))<3 or length(als)>1000 then raise exception 'Isi alasan/catatan minimal 3 huruf';end if;
 perform pg_advisory_xact_lock(hashtextextended('stok-outlet:'||req::text,0));
 select hasil into r from stok_outlet_internal.perintah where id=req and pengguna=auth.uid() and payload=p;
 if r is not null then return r;end if;
 if exists(select 1 from stok_outlet_internal.perintah where id=req) then raise exception 'Permintaan sudah dipakai untuk isi berbeda';end if;
 if op in('proses_restock','batal_restock') then
  select * into x from public.permintaan_stok_outlet where id=(p->>'id')::uuid for update;o:=x.outlet_id;
 elsif op in('terima_transfer','batal_transfer') then
  select * into tr from public.transfer_stok_terima where id=(p->>'id')::uuid for update;o:=tr.asal;
 end if;
 if op='terima_transfer' then
  if not stok_outlet_internal.kelola(tr.tujuan) then raise exception 'Hanya petugas outlet tujuan yang dapat menerima';end if;
 elsif op='batal_transfer' then
  if not(stok_outlet_internal.kelola(tr.asal) or stok_outlet_internal.kelola(tr.tujuan)) then raise exception 'Tidak diizinkan';end if;
 elsif not stok_outlet_internal.kelola(o) then raise exception 'Tidak diizinkan mengubah stok outlet ini';end if;
 if not exists(select 1 from public.outlet where id=o and mode='asli' and deleted_at is null) then raise exception 'Outlet tidak tersedia';end if;
 if op in('setelan','koreksi','waste') then
  select * into bn from public.bahan where id=b and mode='asli' and deleted_at is null;
  if bn.id is null then raise exception 'Bahan tidak tersedia';end if;
  if op='setelan' then
   q:=(p->>'minimum')::numeric;
   if q is null or q<0 or q>1000000000 or q<>round(q,3) then raise exception 'Stok minimum tidak valid; maksimal 3 desimal';end if;
   insert into public.setelan_stok_outlet(outlet_id,bahan_id,aktif,minimum,alasan,diubah_oleh)
   values(o,b,coalesce((p->>'aktif')::boolean,true),q,als,auth.uid()) on conflict(outlet_id,bahan_id) do update set
   aktif=excluded.aktif,minimum=excluded.minimum,alasan=excluded.alasan,diubah_oleh=auth.uid(),diubah_at=now();
  else
   q:=(p->>'jumlah')::numeric;
   if q is null or q<0 or q>1000000000 or q<>round(q,3) or (op='waste' and q=0) then raise exception 'Jumlah tidak valid; maksimal 3 desimal';end if;
   insert into public.stok(mode,outlet_id,bahan_id,jumlah) values('asli',o,b,0) on conflict(mode,outlet_id,bahan_id) do nothing;
   select jumlah into lama from public.stok where mode='asli' and outlet_id=o and bahan_id=b for update;
   if p->>'stok_sebelum' is null or lama<>(p->>'stok_sebelum')::numeric then raise exception 'Stok berubah. Muat ulang dan periksa jumlah terbaru';end if;
   if op='waste' and q>lama then raise exception 'Waste melebihi stok tersedia';end if;
   if photo<>'' and (photo not like o::text||'/'||auth.uid()::text||'/%' or not exists(select 1 from storage.objects where bucket_id='stok-outlet-bukti' and name=photo)) then raise exception 'Bukti foto tidak tersedia';end if;
   perform public.geser_stok('asli',o,b,case when op='waste' then -q else q-lama end,case when op='waste' then 'waste' else 'koreksi' end,req,als);
   insert into public.log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_baru) values(auth.uid(),'stok_outlet_'||op,'mutasi_stok',req::text,jsonb_build_object('outlet_id',o,'bahan_id',b,'sebelum',lama,'jumlah',q,'alasan',als,'foto',photo));
  end if;
 elsif op in('restock','transfer') then
  if jsonb_typeof(p->'items')<>'array' or coalesce(jsonb_array_length(p->'items'),0) not between 1 and 50 then raise exception 'Pilih 1-50 bahan';end if;
  for it in select * from jsonb_array_elements(p->'items') loop
   bid:=(it->>'bahan_id')::uuid;q:=(it->>'jumlah')::numeric;
   select * into bn from public.bahan where id=bid and mode='asli' and deleted_at is null;
   if bn.id is null or bid=any(seen) or q is null or q<=0 or q>1000000000 or q<>round(q,3) then raise exception 'Bahan/jumlah tidak valid atau berulang';end if;
   if exists(select 1 from public.setelan_stok_outlet where outlet_id=o and bahan_id=bid and not aktif) then raise exception 'Aktifkan bahan pada outlet dahulu';end if;
   seen:=array_append(seen,bid);arr:=arr||jsonb_build_array(jsonb_build_object('bahan_id',bid,'nama',bn.nama,'satuan',bn.satuan_pakai,'jumlah',q));
  end loop;
  if op='restock' then
   insert into public.permintaan_stok_outlet(id,outlet_id,items,catatan,oleh) values(req,o,arr,als,auth.uid());
  else
   ke:=(p->>'tujuan')::uuid;
   if ke=o or not exists(select 1 from public.outlet where id=ke and mode='asli' and deleted_at is null) then raise exception 'Pilih outlet tujuan berbeda';end if;
   insert into public.transfer_stok_terima(id,asal,tujuan,items,catatan,oleh) values(req,o,ke,arr,als,auth.uid());
  end if;
 elsif op in('proses_restock','batal_restock') then
  if x.id is null or x.status<>'diminta' then raise exception 'Permintaan sudah diproses atau dibatalkan';end if;
  if op='proses_restock' then
   if not stok_outlet_internal.pusat() then raise exception 'Hanya Gudang/Pusat yang memproses';end if;
   insert into public.kiriman(outlet_id,tanggal,catatan,pengirim) values(o,public.tgl_op(now()),'Restock '||x.id||': '||als,(select nama from public.pengguna where id=auth.uid())) returning id into kid;
   for it in select * from jsonb_array_elements(x.items) loop
    select * into bn from public.bahan where id=(it->>'bahan_id')::uuid and mode='asli' and deleted_at is null;
    if bn.id is null or bn.satuan_pakai is distinct from it->>'satuan' or bn.konversi<=0 then raise exception 'Bahan atau konversi sudah berubah/tidak tersedia';end if;
    insert into public.item_kiriman(kiriman_id,bahan_id,nama,satuan,konversi,qty,harga)
    values(kid,bn.id,bn.nama,bn.satuan_beli,bn.konversi,(it->>'jumlah')::numeric/bn.konversi,bn.harga_jual_gudang);
   end loop;
   update public.kiriman set total=(select coalesce(sum(round(qty*harga)),0) from public.item_kiriman where kiriman_id=kid) where id=kid;
  end if;
  update public.permintaan_stok_outlet set status=case when op='proses_restock' then 'diproses' else 'batal' end,kiriman_id=kid,updated_at=now() where id=x.id;
 elsif op in('terima_transfer','batal_transfer') then
  if tr.id is null or tr.status<>'menunggu' then raise exception 'Transfer sudah diselesaikan';end if;
  if op='terima_transfer' then
   if not exists(select 1 from public.outlet where id=tr.tujuan and mode='asli' and deleted_at is null) then raise exception 'Outlet tujuan tidak tersedia';end if;
   -- Deterministic locks, then inspect all items before moving any stock. POS updates use the same stock rows.
   for bid in select (z->>'bahan_id')::uuid from jsonb_array_elements(tr.items) z order by 1 loop
    insert into public.stok(mode,outlet_id,bahan_id,jumlah) values('asli',tr.asal,bid,0),('asli',tr.tujuan,bid,0) on conflict(mode,outlet_id,bahan_id) do nothing;
    perform id from public.stok where mode='asli' and bahan_id=bid and outlet_id in(tr.asal,tr.tujuan) order by outlet_id for update;
   end loop;
   for it in select * from jsonb_array_elements(tr.items) loop
    bid:=(it->>'bahan_id')::uuid;q:=(it->>'jumlah')::numeric;
    select jumlah into lama from public.stok where mode='asli' and outlet_id=tr.asal and bahan_id=bid;
    if lama<q then raise exception 'Stok asal tidak cukup untuk %; hubungi pengirim',it->>'nama';end if;
    if not exists(select 1 from public.bahan where id=bid and deleted_at is null and satuan_pakai=it->>'satuan') then raise exception 'Bahan dinonaktifkan secara global';end if;
    perform public.geser_stok('asli',tr.asal,bid,-q,'transfer_keluar',tr.id,'Transfer ke '||(select nama from public.outlet where id=tr.tujuan)||': '||als);
    perform public.geser_stok('asli',tr.tujuan,bid,q,'transfer_masuk',tr.id,'Transfer dari '||(select nama from public.outlet where id=tr.asal)||': '||als);
   end loop;
  end if;
  update public.transfer_stok_terima set status=case when op='terima_transfer' then 'diterima' else 'batal' end,diputus_oleh=auth.uid(),diputus_at=now(),alasan=als where id=tr.id;
 else raise exception 'Tindakan tidak dikenal';end if;
 r:=jsonb_build_object('ok','Tersimpan. Riwayat perubahan tercatat.','id',coalesce(kid,req));
 insert into stok_outlet_internal.perintah(id,pengguna,payload,hasil) values(req,auth.uid(),p,r);return r;
end $$;

-- Private proof storage: no public URLs, accessible only within the staff member's outlet scope.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('stok-outlet-bukti','stok-outlet-bukti',false,5242880,array['image/jpeg','image/png','image/webp']);
create function stok_outlet_internal.foto_izin(path text,tulis boolean) returns boolean language plpgsql stable security definer set search_path='' as $$
declare o uuid;
begin
 if path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$' then return false;end if;
 o:=split_part(path,'/',1)::uuid;
 return case when tulis then stok_outlet_internal.kelola(o) and split_part(path,'/',2)=auth.uid()::text else stok_outlet_internal.lihat(o) end;
end $$;
create policy stok_foto_upload on storage.objects for insert to authenticated with check(bucket_id='stok-outlet-bukti' and stok_outlet_internal.foto_izin(name,true));
create policy stok_foto_baca on storage.objects for select to authenticated using(bucket_id='stok-outlet-bukti' and stok_outlet_internal.foto_izin(name,false));

create function public.kelola_stok_outlet(p jsonb) returns jsonb language sql security invoker set search_path='' as $$select stok_outlet_internal.perintah(p)$$;
revoke all on all functions in schema stok_outlet_internal from public,anon,authenticated;
grant execute on function stok_outlet_internal.pusat(),stok_outlet_internal.lihat(uuid),stok_outlet_internal.kelola(uuid),stok_outlet_internal.foto_izin(text,boolean),stok_outlet_internal.perintah(jsonb) to authenticated;
revoke all on function public.kelola_stok_outlet(jsonb) from public,anon;
grant execute on function public.kelola_stok_outlet(jsonb) to authenticated;

create function stok_outlet_internal.laporan(o uuid,d date,a date,b uuid,cursor_waktu timestamptz,cursor_id uuid,batas timestamptz) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare mulai timestamptz;selesai timestamptz;hasil jsonb;baca timestamptz:=coalesce(batas,now());
begin
 if auth.uid() is null or not exists(select 1 from public.pengguna where id=auth.uid() and status='aktif') then raise exception 'Tidak diizinkan';end if;
 if baca>now() then raise exception 'Batas baca tidak valid';end if;
 if d is null or a is null or a<d or a-d>365 or a>public.tgl_op(now()) then raise exception 'Pilih periode maksimal 366 hari sampai hari operasional ini';end if;
 if (cursor_waktu is null)<>(cursor_id is null) then raise exception 'Kursor tidak valid';end if;
 if o is not null and not stok_outlet_internal.lihat(o) then raise exception 'Tidak diizinkan';end if;
 if o is null and not (stok_outlet_internal.pusat() or public.punya_peran('{finance,hrd,manajer_area}')) then raise exception 'Pilih outlet yang diizinkan';end if;
 mulai:=public.awal_op(d);selesai:=public.awal_op(a+1);
 with lokasi as(select id,nama from public.outlet where mode='asli' and deleted_at is null and (o is null or id=o) and stok_outlet_internal.lihat(id)),
 rentang as(select m.* from public.mutasi_stok m join lokasi l on l.id=m.outlet_id where m.mode='asli' and m.created_at>=mulai and m.created_at<selesai and m.created_at<=baca and (b is null or m.bahan_id=b)),
 kunci as(select s.outlet_id,s.bahan_id from public.stok s join lokasi l on l.id=s.outlet_id where s.mode='asli' and (b is null or s.bahan_id=b)
 union select outlet_id,bahan_id from rentang
 union select s.outlet_id,s.bahan_id from public.setelan_stok_outlet s join lokasi l on l.id=s.outlet_id where b is null or s.bahan_id=b),
 agr as(select outlet_id,bahan_id,sum(jumlah) net,
 coalesce(sum(jumlah) filter(where jumlah>0 and jenis not in('void','opname','koreksi')),0) masuk,
 coalesce(-sum(jumlah) filter(where jenis='pemakaian'),0) pakai,
 coalesce(sum(jumlah) filter(where jenis='void'),0) kembali,
 coalesce(-sum(jumlah) filter(where jenis='waste'),0) waste,
 coalesce(-sum(jumlah) filter(where jenis='marketing'),0) marketing,
 coalesce(sum(jumlah) filter(where jenis='opname'),0) so,
 coalesce(sum(jumlah) filter(where jenis='koreksi'),0) koreksi,
 coalesce(-sum(jumlah) filter(where jumlah<0 and jenis not in('pemakaian','waste','marketing','opname','koreksi')),0) keluar_lain
 from rentang group by outlet_id,bahan_id),
 sesudah as(select m.outlet_id,m.bahan_id,sum(m.jumlah) jumlah from public.mutasi_stok m join lokasi l on l.id=m.outlet_id where m.mode='asli' and m.created_at>=selesai and (b is null or m.bahan_id=b) group by m.outlet_id,m.bahan_id),
 rows as(select k.outlet_id,l.nama outlet,k.bahan_id,bh.nama,bh.satuan_pakai satuan,
 coalesce(s.jumlah,0)-coalesce(z.jumlah,0)-coalesce(g.net,0) awal,
 coalesce(s.jumlah,0)-coalesce(z.jumlah,0) akhir,coalesce(s.jumlah,0) sekarang,
 coalesce(cfg.minimum,bh.stok_min) minimum,coalesce(cfg.aktif,true) aktif,
 coalesce(g.masuk,0) masuk,coalesce(g.pakai,0) pakai,coalesce(g.kembali,0) kembali,coalesce(g.waste,0) waste,
 coalesce(g.marketing,0) marketing,coalesce(g.so,0) so,coalesce(g.koreksi,0) koreksi,coalesce(g.keluar_lain,0) keluar_lain
 from kunci k join lokasi l on l.id=k.outlet_id join public.bahan bh on bh.id=k.bahan_id
 left join public.stok s on s.mode='asli' and s.outlet_id=k.outlet_id and s.bahan_id=k.bahan_id
 left join public.setelan_stok_outlet cfg on cfg.outlet_id=k.outlet_id and cfg.bahan_id=k.bahan_id
 left join agr g on g.outlet_id=k.outlet_id and g.bahan_id=k.bahan_id left join sesudah z on z.outlet_id=k.outlet_id and z.bahan_id=k.bahan_id),
 riwayat as(select m.id,m.created_at,m.outlet_id,l.nama outlet,m.bahan_id,bh.nama,bh.satuan_pakai satuan,m.jenis,m.jumlah,m.keterangan,m.ref_id,u.nama petugas,cmd.payload->>'foto' foto
 from rentang m join lokasi l on l.id=m.outlet_id join public.bahan bh on bh.id=m.bahan_id left join public.pengguna u on u.id=m.dibuat_oleh left join stok_outlet_internal.perintah cmd on cmd.id=m.ref_id
 where cursor_waktu is null or (m.created_at,m.id)<(cursor_waktu,cursor_id) order by m.created_at desc,m.id desc limit 501)
 select jsonb_build_object('ringkasan',coalesce((select jsonb_agg(to_jsonb(r) order by r.outlet,r.nama) from rows r),'[]'),
 'riwayat',coalesce((select jsonb_agg(to_jsonb(v) order by v.created_at desc,v.id desc) from (select * from riwayat limit 500) v),'[]'),
 'lanjut',(select count(*)>500 from riwayat),'mulai',mulai,'selesai',selesai,'dibaca_at',baca,
 'setelan',coalesce((select jsonb_agg(v order by v.created_at desc) from (select c.created_at,l.nama outlet,bh.nama,u.nama petugas,c.payload->>'alasan' alasan,c.payload->'minimum' minimum,c.payload->'aktif' aktif from stok_outlet_internal.perintah c join lokasi l on l.id=nullif(c.payload->>'outlet_id','')::uuid join public.bahan bh on bh.id=nullif(c.payload->>'bahan_id','')::uuid join public.pengguna u on u.id=c.pengguna where c.payload->>'aksi'='setelan' and c.created_at>=mulai and c.created_at<selesai and c.created_at<=baca and (b is null or bh.id=b) order by c.created_at desc limit 100) v),'[]'),
 'awal_riwayat',(select min(created_at) from public.mutasi_stok where mode='asli' and outlet_id in(select id from lokasi))) into hasil;
 return hasil;
end $$;
create function public.laporan_stok_outlet(p_outlet uuid,p_awal date,p_akhir date,p_bahan uuid default null,p_cursor_waktu timestamptz default null,p_cursor_id uuid default null,p_batas timestamptz default null) returns jsonb
language sql security invoker set search_path='' as $$select stok_outlet_internal.laporan(p_outlet,p_awal,p_akhir,p_bahan,p_cursor_waktu,p_cursor_id,p_batas)$$;
revoke all on function stok_outlet_internal.laporan(uuid,date,date,uuid,timestamptz,uuid,timestamptz),public.laporan_stok_outlet(uuid,date,date,uuid,timestamptz,uuid,timestamptz) from public,anon;
grant execute on function stok_outlet_internal.laporan(uuid,date,date,uuid,timestamptz,uuid,timestamptz),public.laporan_stok_outlet(uuid,date,date,uuid,timestamptz,uuid,timestamptz) to authenticated;

create function public.tujuan_stok_outlet() returns jsonb language sql stable security definer set search_path='' as $$
 select case when auth.uid() is not null and exists(select 1 from public.pengguna where id=auth.uid() and status='aktif') and public.punya_peran('{owner,admin_pusat,admin_gudang,finance,hrd,spv,manajer_area}')
 then (select coalesce(jsonb_agg(jsonb_build_object('id',id,'nama',nama) order by nama),'[]') from public.outlet where mode='asli' and deleted_at is null) else '[]'::jsonb end
$$;
revoke all on function public.tujuan_stok_outlet() from public,anon;
grant execute on function public.tujuan_stok_outlet() to authenticated;
