-- Subsidi is a separate office receivable. Settlement never creates another POS sale.
alter table promo_internal.promo add column subsidi boolean not null default false,add column nama_subsidi text not null default 'Subsidi Kantor' check(length(trim(nama_subsidi)) between 1 and 120);
create table promo_internal.tagihan (
 id uuid primary key default gen_random_uuid(),transaksi_id uuid not null unique references public.transaksi(id),promo_id uuid not null references promo_internal.promo(id),outlet_id uuid not null references public.outlet(id),tanggal date not null,
 nama text not null check(length(trim(nama)) between 1 and 120),nominal_awal bigint not null check(nominal_awal>0),nominal bigint not null check(nominal>=0),catatan text not null default '',versi integer not null default 1,created_at timestamptz not null default now()
);
create table promo_internal.pelunasan (
 id uuid primary key,tagihan_id uuid not null references promo_internal.tagihan(id),tanggal date not null,jumlah bigint not null check(jumlah<>0),bukti text not null,catatan text not null,oleh uuid not null references public.pengguna(id),created_at timestamptz not null default now(),batal_at timestamptz,batal_oleh uuid references public.pengguna(id),alasan_batal text
);
alter table promo_internal.tagihan enable row level security;
alter table promo_internal.pelunasan enable row level security;
create index subsidi_tagihan_outlet on promo_internal.tagihan(outlet_id,tanggal);
create index subsidi_pelunasan_tagihan on promo_internal.pelunasan(tagihan_id);
create function promo_internal.akunting() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.pengguna where id=auth.uid() and status='aktif') and public.punya_peran('{owner,admin_pusat,finance}');
$$;
-- Extend the existing price/permission code; retain the ordinary discount path.
do $patch$
declare f text; old text; new text;
begin
 f:=pg_get_functiondef('promo_internal.simpan(jsonb)'::regprocedure);
 f:=replace(f,'''persen'',''potongan'',''harga_akhir''','''persen'',''potongan'',''harga_akhir'',''gratis''');
 old:='insert into public.log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_lama,nilai_baru)';
 new:=$code$if exists(select 1 from jsonb_array_elements(p->'aturan') ar where ar->>'jenis'='gratis') and not coalesce((p->>'subsidi')::boolean,false) then raise exception 'Gratis harus memakai subsidi'; end if;
 update promo_internal.promo set subsidi=coalesce((p->>'subsidi')::boolean,false),nama_subsidi=coalesce(nullif(trim(p->>'nama_subsidi'),''),'Subsidi Kantor') where id=x.id;
 insert into public.log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_lama,nilai_baru)$code$;
 if strpos(f,old)=0 then raise exception 'Subsidi: save anchor changed';end if;f:=replace(f,old,new);execute f;
 f:=pg_get_functiondef('promo_internal.pesan(jsonb)'::regprocedure);
 old:=$s$case a->>'jenis' when 'persen'$s$;
 new:=$s$case a->>'jenis' when 'gratis' then harga when 'persen'$s$;
 if strpos(f,old)=0 then raise exception 'Subsidi: price anchor changed';end if;f:=replace(f,old,new);
 old:=$s$if sub-pot-greatest(coalesce((p->>'diskon')::bigint,0),0)<=0 then$s$;
 new:=$s$if sub-pot-greatest(coalesce((p->>'diskon')::bigint,0),0)<0 or (sub-pot-greatest(coalesce((p->>'diskon')::bigint,0),0)=0 and not x.subsidi) then$s$;
 if strpos(f,old)=0 then raise exception 'Subsidi: zero anchor changed';end if;f:=replace(f,old,new);
 f:=replace(f,$s$'sisa',sisa)$s$,$s$'sisa',sisa,'subsidi',x.subsidi,'nama_subsidi',x.nama_subsidi)$s$);
 f:=replace(f,$s$'sisa',r.snapshot->'sisa')$s$,$s$'sisa',r.snapshot->'sisa','subsidi',coalesce((r.snapshot->>'subsidi')::boolean,false),'nama_subsidi',r.snapshot->>'nama_subsidi')$s$);execute f;
 f:=pg_get_functiondef('promo_internal.pakai(jsonb,uuid,bigint)'::regprocedure);
 old:=' return r.diskon;';new:=$code$ if coalesce((r.snapshot->>'subsidi')::boolean,false) then
  insert into promo_internal.tagihan(transaksi_id,promo_id,outlet_id,tanggal,nama,nominal_awal,nominal) values(t,r.promo_id,r.outlet_id,r.tanggal,r.snapshot->>'nama_subsidi',r.diskon,r.diskon);
 end if;
 return r.diskon;$code$;
 if strpos(f,old)=0 then raise exception 'Subsidi: consume anchor changed';end if;execute replace(f,old,new);
 f:=pg_get_functiondef('matur_internal.buat_transaksi(jsonb)'::regprocedure);
 old:='  for b in select * from jsonb_array_elements(v_bayar) loop';
 new:=$code$  if v_total=0 and coalesce((v_quote#>>'{snapshot,subsidi}')::boolean,false) then
    if jsonb_array_length(coalesce(p->'pembayaran','[]'))>0 or coalesce((p->>'diterima')::bigint,0)>0 then raise exception 'Subsidi penuh tidak menerima pembayaran pelanggan';end if;
    v_bayar:='[]'::jsonb;
  end if;
  for b in select * from jsonb_array_elements(v_bayar) loop$code$;
 if strpos(f,old)=0 then raise exception 'Subsidi: payment anchor changed';end if;
 -- Only the first payment loop; the insert loop must keep its original shape.
 f:=overlay(f placing new from strpos(f,old) for length(old));execute f;
end $patch$;

create function promo_internal.edit_tagihan(p jsonb) returns void language plpgsql security definer set search_path='' as $$
declare x promo_internal.tagihan; lama jsonb; bayar bigint;n bigint;v_nama text;alasan text;
begin
 if not promo_internal.akunting() then raise exception 'Hanya Accounting/Pusat';end if;
 select * into x from promo_internal.tagihan where id=(p->>'id')::uuid for update;
 if x.id is null then raise exception 'Tagihan tidak ditemukan';end if;
 if x.versi is distinct from (p->>'versi')::integer then raise exception 'Data berubah. Muat ulang';end if;
 if not exists(select 1 from public.transaksi where id=x.transaksi_id and status='lunas') then raise exception 'Transaksi void/hapus; selesaikan pengembalian melalui catatan pembayaran';end if;
 n:=(p->>'nominal')::bigint;v_nama:=trim(p->>'nama');alasan:=trim(p->>'alasan');
 if n is null or n<0 or v_nama is null or length(v_nama) not between 1 and 120 or alasan is null or length(alasan) not between 3 and 500 then raise exception 'Isi nama, nominal dan alasan koreksi (min. 3 huruf)';end if;
 select coalesce(sum(jumlah),0) into bayar from promo_internal.pelunasan where tagihan_id=x.id and batal_at is null;
 if n<bayar then raise exception 'Nominal di bawah pembayaran bersih. Catat pengembalian/koreksi pembayaran terlebih dahulu';end if;
 lama:=to_jsonb(x);
 update promo_internal.tagihan set nama=v_nama,nominal=n,catatan=left(coalesce(p->>'catatan',''),1000),versi=versi+1 where id=x.id;
 insert into public.log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_lama,nilai_baru) select auth.uid(),'koreksi_subsidi','subsidi',x.id::text,lama,to_jsonb(t)||jsonb_build_object('alasan',alasan) from promo_internal.tagihan t where t.id=x.id;
end $$;
create function promo_internal.bayar_tagihan(p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare x promo_internal.tagihan;b promo_internal.pelunasan; j bigint;terbayar bigint;target bigint; tgl date;file text;cat text;i uuid:=(p->>'request_id')::uuid;
begin
 if not promo_internal.akunting() then raise exception 'Hanya Accounting/Pusat';end if;
 select * into x from promo_internal.tagihan where id=(p->>'id')::uuid for update;
 if x.id is null then raise exception 'Tagihan tidak ditemukan';end if;
 j:=(p->>'jumlah')::bigint;tgl:=(p->>'tanggal')::date;file:=p->>'bukti';cat:=trim(p->>'catatan');
 select * into b from promo_internal.pelunasan where id=i;
 if b.id is not null then
  if b.tagihan_id<>x.id or b.jumlah is distinct from j or b.tanggal is distinct from tgl or b.bukti is distinct from file or b.catatan is distinct from cat then raise exception 'ID pembayaran sudah digunakan';end if;
  return b.id;
 end if;
 if x.versi is distinct from (p->>'versi')::integer then raise exception 'Data berubah. Muat ulang sebelum mencatat pembayaran';end if;
 if i is null or j is null or j=0 or tgl is null or tgl>(now() at time zone 'Asia/Jakarta')::date or cat is null or length(cat) not between 3 and 500 then raise exception 'Isi tanggal, nominal dan catatan pembayaran';end if;
 if file is null or split_part(file,'/',1)<>auth.uid()::text or not exists(select 1 from storage.objects where bucket_id='subsidi-bukti' and name=file) then raise exception 'Unggah bukti pembayaran/pengembalian terlebih dahulu';end if;
 select coalesce(sum(jumlah),0) into terbayar from promo_internal.pelunasan where tagihan_id=x.id and batal_at is null;
 select case when status='lunas' then x.nominal else 0 end into target from public.transaksi where id=x.transaksi_id;
 if j>0 and j>greatest(target-terbayar,0) then raise exception 'Pembayaran melebihi sisa tagihan';end if;
 if j<0 and -j>terbayar then raise exception 'Pengembalian melebihi pembayaran bersih';end if;
 insert into promo_internal.pelunasan(id,tagihan_id,tanggal,jumlah,bukti,catatan,oleh) values(i,x.id,tgl,j,file,cat,auth.uid());
 update promo_internal.tagihan set versi=versi+1 where id=x.id;
 insert into public.log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_baru) values(auth.uid(),'bayar_subsidi','subsidi',x.id::text,p);
 return i;
end $$;
create function promo_internal.batal_bayar(p jsonb) returns void language plpgsql security definer set search_path='' as $$
declare b promo_internal.pelunasan;x promo_internal.tagihan;alasan text:=trim(p->>'alasan');sisa bigint;
begin
 if not promo_internal.akunting() then raise exception 'Hanya Accounting/Pusat';end if;
 -- Tagihan first, then payment: same lock order as payment insertion.
 select * into x from promo_internal.tagihan where id=(select tagihan_id from promo_internal.pelunasan where id=(p->>'id')::uuid) for update;
 select * into b from promo_internal.pelunasan where id=(p->>'id')::uuid for update;
 if b.id is null or alasan is null or length(alasan) not between 3 and 500 then raise exception 'Isi alasan koreksi pembayaran';end if;
 if b.batal_at is not null then return;end if;
 if x.versi is distinct from (p->>'versi')::integer then raise exception 'Data berubah. Muat ulang';end if;
 select coalesce(sum(jumlah),0)-b.jumlah into sisa from promo_internal.pelunasan where tagihan_id=x.id and batal_at is null;
 if sisa<0 then raise exception 'Batalkan pengembalian terkait terlebih dahulu';end if;
 update promo_internal.pelunasan set batal_at=now(),batal_oleh=auth.uid(),alasan_batal=alasan where id=b.id;
 update promo_internal.tagihan set versi=versi+1 where id=x.id;
 insert into public.log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_lama,nilai_baru) values(auth.uid(),'batal_bayar_subsidi','subsidi',x.id::text,to_jsonb(b),jsonb_build_object('alasan',alasan));
end $$;
create function promo_internal.laporan_subsidi(o uuid,d date,s date) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not promo_internal.akunting() then raise exception 'Hanya Accounting/Pusat';end if;
 if d is null or s is null or s<d or s-d>366 then raise exception 'Pilih periode maksimal 366 hari';end if;
 return coalesce((select jsonb_agg(z order by z->>'waktu' desc) from (
 select to_jsonb(x)||jsonb_build_object('waktu',t.created_at,'nomor',t.nomor,'outlet',ot.nama,'status_transaksi',t.status,'pelanggan_bayar',t.total,
 'items',(select coalesce(jsonb_agg(jsonb_build_object('nama',it.nama,'qty',it.qty,'harga',it.harga)),'[]') from public.item_transaksi it where it.transaksi_id=t.id),
 'riwayat',(select coalesce(jsonb_agg(to_jsonb(l) order by l.waktu desc),'[]') from (select a.waktu,a.aksi,a.nilai_lama,a.nilai_baru,u.nama as pengguna from public.log_aktivitas a left join public.pengguna u on u.id=a.pengguna_id where a.entitas='subsidi' and a.entitas_id=x.id::text order by a.waktu desc limit 100) l),'target',case when t.status='lunas' then x.nominal else 0 end,'terbayar',coalesce(b.jumlah,0),'pembayaran',coalesce(b.rincian,'[]')) z
 from promo_internal.tagihan x join public.transaksi t on t.id=x.transaksi_id join public.outlet ot on ot.id=x.outlet_id
 left join lateral (select sum(jumlah) filter(where batal_at is null) jumlah,jsonb_agg(to_jsonb(p) order by created_at desc) rincian from promo_internal.pelunasan p where p.tagihan_id=x.id) b on true
 where x.tanggal between d and s and (o is null or x.outlet_id=o)
 ) a),'[]');
end $$;
create function public.edit_tagihan_subsidi(p jsonb) returns void language sql security invoker set search_path='' as $$select promo_internal.edit_tagihan(p)$$;
create function public.bayar_tagihan_subsidi(p jsonb) returns uuid language sql security invoker set search_path='' as $$select promo_internal.bayar_tagihan(p)$$;
create function public.batal_bayar_subsidi(p jsonb) returns void language sql security invoker set search_path='' as $$select promo_internal.batal_bayar(p)$$;
create function public.laporan_subsidi(o uuid,d date,s date) returns jsonb language sql security invoker set search_path='' as $$select promo_internal.laporan_subsidi(o,d,s)$$;
revoke all on function promo_internal.akunting(),promo_internal.edit_tagihan(jsonb),promo_internal.bayar_tagihan(jsonb),promo_internal.batal_bayar(jsonb),promo_internal.laporan_subsidi(uuid,date,date) from public,anon,authenticated;
grant execute on function promo_internal.akunting(),promo_internal.edit_tagihan(jsonb),promo_internal.bayar_tagihan(jsonb),promo_internal.batal_bayar(jsonb),promo_internal.laporan_subsidi(uuid,date,date) to authenticated;
revoke all on function public.edit_tagihan_subsidi(jsonb),public.bayar_tagihan_subsidi(jsonb),public.batal_bayar_subsidi(jsonb),public.laporan_subsidi(uuid,date,date) from public,anon;
grant execute on function public.edit_tagihan_subsidi(jsonb),public.bayar_tagihan_subsidi(jsonb),public.batal_bayar_subsidi(jsonb),public.laporan_subsidi(uuid,date,date) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('subsidi-bukti','subsidi-bukti',false,5242880,array['image/jpeg','image/png','application/pdf']);
create policy subsidi_upload on storage.objects for insert to authenticated with check(bucket_id='subsidi-bukti' and promo_internal.akunting() and (storage.foldername(name))[1]=auth.uid()::text);
create policy subsidi_baca on storage.objects for select to authenticated using(bucket_id='subsidi-bukti' and promo_internal.akunting());
-- Marketing reconciliation: discount already reduces POS net sales; do not post a duplicate expense.
create function promo_internal.marketing(o uuid,d date,s date) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not promo_internal.akunting() then raise exception 'Hanya Accounting/Pusat';end if;
 if d is null or s is null or s<d or s-d>366 then raise exception 'Pilih periode maksimal 366 hari';end if;
 return coalesce((select jsonb_agg(z order by z->>'waktu' desc) from (
 select jsonb_build_object('id',t.id,'nomor',t.nomor,'waktu',t.created_at,'tanggal',public.tgl_op(t.created_at),'outlet',ot.nama,'status',t.status,'nama',coalesce(t.promo_snapshot->>'nama','Diskon manual'),
 'nama_subsidi',t.promo_snapshot->>'nama_subsidi','subtotal',t.subtotal,'total',t.total,'diskon',t.diskon,'subsidi',case when coalesce((t.promo_snapshot->>'subsidi')::boolean,false) then (t.promo_snapshot->>'diskon')::bigint else 0 end,
 'manual',greatest(t.diskon-coalesce((t.promo_snapshot->>'diskon')::bigint,0),0),'catatan',t.catatan,'alasan_void',to_jsonb(t)->>'void_alasan','operator',coalesce(to_jsonb(t)->>'operator_nama',(select nama from public.pengguna where id=t.dibuat_oleh)),
 'items',(select coalesce(jsonb_agg(jsonb_build_object('nama',it.nama,'qty',it.qty,'harga',it.harga)),'[]') from public.item_transaksi it where it.transaksi_id=t.id)) z
 from public.transaksi t join public.outlet ot on ot.id=t.outlet_id where t.mode='asli' and t.diskon>0 and public.tgl_op(t.created_at) between d and s and (o is null or t.outlet_id=o)
 ) a),'[]');
end $$;
create function public.laporan_marketing_diskon(o uuid,d date,s date) returns jsonb language sql security invoker set search_path='' as $$select promo_internal.marketing(o,d,s)$$;
revoke all on function promo_internal.marketing(uuid,date,date),public.laporan_marketing_diskon(uuid,date,date) from public,anon;
grant execute on function promo_internal.marketing(uuid,date,date),public.laporan_marketing_diskon(uuid,date,date) to authenticated;
