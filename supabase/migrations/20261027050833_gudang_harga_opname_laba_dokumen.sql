create schema gudang_internal;
revoke all on schema gudang_internal from public,anon;
grant usage on schema gudang_internal to authenticated;
create function gudang_internal.boleh(tulis boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.pengguna u join public.penugasan t on t.pengguna_id=u.id where u.id=auth.uid() and u.status='aktif' and (t.peran in ('owner','admin_pusat','admin_gudang') or (not tulis and t.peran='finance')))
$$;
revoke all on function gudang_internal.boleh(boolean) from public,anon;
grant execute on function gudang_internal.boleh(boolean) to authenticated;
alter table public.item_kiriman add column hpp_gudang numeric check(hpp_gudang>=0);
alter table public.kiriman add column pembuat_nama text,add column pemeriksa_nama text,add column diperiksa_at timestamptz,add column kepemilikan_snapshot text;
alter table public.mutasi_stok add column hpp_gudang numeric check(hpp_gudang>=0);
create table public.opname_gudang (
 id uuid primary key default gen_random_uuid(),request_id uuid not null unique,tanggal date not null,status text not null default 'draft' check(status in ('draft','final','batal')),
 catatan text not null default '',versi integer not null default 0,dibuat_oleh uuid not null references public.pengguna(id),nama_petugas text not null,
 created_at timestamptz not null default clock_timestamp(),final_at timestamptz
);
create index opname_gudang_petugas on public.opname_gudang(dibuat_oleh);
create table public.item_opname_gudang (
 opname_id uuid not null references public.opname_gudang(id),bahan_id uuid not null references public.bahan(id),nama text not null,satuan text not null,
 sistem numeric not null,stok_at timestamptz,fisik numeric check(fisik>=0),hpp numeric check(hpp>=0),alasan text not null default '',primary key(opname_id,bahan_id)
);
create index item_opname_gudang_bahan on public.item_opname_gudang(bahan_id);
create table public.biaya_gudang (
 id uuid primary key default gen_random_uuid(),request_id uuid not null unique,tanggal date not null,jumlah bigint not null check(jumlah>0),
 keterangan text not null,outlet_id uuid references public.outlet(id),dibuat_oleh uuid not null references public.pengguna(id),created_at timestamptz not null default now(),deleted_at timestamptz,alasan_batal text
);
create index biaya_gudang_outlet on public.biaya_gudang(outlet_id);
create index biaya_gudang_petugas on public.biaya_gudang(dibuat_oleh);
create index biaya_gudang_tanggal on public.biaya_gudang(tanggal) where deleted_at is null;
alter table public.opname_gudang enable row level security;
alter table public.item_opname_gudang enable row level security;
alter table public.biaya_gudang enable row level security;
create policy baca on public.opname_gudang for select to authenticated using((select gudang_internal.boleh()));
create policy baca on public.item_opname_gudang for select to authenticated using((select gudang_internal.boleh()));
create policy baca on public.biaya_gudang for select to authenticated using((select gudang_internal.boleh()));
revoke all on public.opname_gudang,public.item_opname_gudang,public.biaya_gudang from anon,authenticated;
grant select on public.opname_gudang,public.item_opname_gudang,public.biaya_gudang to authenticated;

create function gudang_internal.harga(p_bahan uuid,p_harga bigint,p_lama bigint) returns void language plpgsql security definer set search_path='' as $$
declare b public.bahan;
begin
 if not gudang_internal.boleh(true) then raise exception 'Hanya admin gudang/pusat/owner aktif';end if;
 if p_harga is null or p_harga<0 or p_harga>1000000000000 then raise exception 'Harga jual tidak valid';end if;
 select * into b from public.bahan where id=p_bahan and mode='asli' and deleted_at is null for update;
 if b.id is null then raise exception 'Bahan tidak ditemukan';end if;
 if b.harga_jual_gudang is distinct from p_lama then raise exception 'Harga sudah berubah. Muat ulang dahulu';end if;
 update public.bahan set harga_jual_gudang=p_harga where id=b.id;
 insert into public.log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_lama,nilai_baru) values(auth.uid(),'harga_jual_gudang','bahan',b.id::text,jsonb_build_object('harga',b.harga_jual_gudang),jsonb_build_object('harga',p_harga));
end $$;
create function public.atur_harga_jual_gudang(p_bahan uuid,p_harga bigint,p_lama bigint) returns void language sql security invoker set search_path='' as $$select gudang_internal.harga(p_bahan,p_harga,p_lama)$$;

create function gudang_internal.pembuat() returns trigger language plpgsql security definer set search_path='' as $$
begin
 new.pembuat_nama:=(select nama from public.pengguna where id=auth.uid());return new;
end $$;
create trigger gudang_pembuat before insert on public.kiriman for each row execute function gudang_internal.pembuat();
create function gudang_internal.pemeriksa(kid uuid,nama text) returns void language plpgsql security definer set search_path='' as $$
declare k public.kiriman;
begin
 if not gudang_internal.boleh(true) then raise exception 'Tidak berwenang';end if;
 if length(trim(coalesce(nama,''))) not between 2 and 100 then raise exception 'Isi nama pemeriksa';end if;
 select * into k from public.kiriman where id=kid and mode='asli' and deleted_at is null for update;
 if k.id is null or k.status<>'draft' then raise exception 'Pemeriksa hanya diatur sebelum pengiriman';end if;
 update public.kiriman set pemeriksa_nama=trim(nama),diperiksa_at=clock_timestamp() where id=kid;
 insert into public.log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_baru) values(auth.uid(),'pemeriksa_kiriman','kiriman',kid::text,jsonb_build_object('nama',trim(nama)));
end $$;
create function public.atur_pemeriksa_kiriman(p_id uuid,p_nama text) returns void language sql security invoker set search_path='' as $$select gudang_internal.pemeriksa(p_id,p_nama)$$;

-- Semua jalur mutasi gudang memakai lock yang sama dengan finalisasi opname.
do $$declare d text;begin
 d:=pg_get_functiondef('public.geser_stok(public.mode_data,uuid,uuid,numeric,text,uuid,text)'::regprocedure);
 if position('begin' in d)=0 then raise exception 'Definisi mutasi berubah';end if;
 d:=replace(d,E'begin\n',E'begin\n  if p_outlet is null then perform pg_advisory_xact_lock(hashtext(\'gudang-stok:asli\'));end if;\n');execute d;
end $$;
create function gudang_internal.snapshot_mutasi() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.outlet_id is null and new.mode='asli' then
  if new.jenis='opname' then select i.hpp into new.hpp_gudang from public.item_opname_gudang i where i.opname_id=new.ref_id and i.bahan_id=new.bahan_id;end if;
  if new.hpp_gudang is null then select nullif(b.harga_pokok,0) into new.hpp_gudang from public.bahan b where id=new.bahan_id;end if;
 end if;return new;
end $$;
create trigger gudang_snapshot_mutasi before insert on public.mutasi_stok for each row execute function gudang_internal.snapshot_mutasi();
alter function public.kirim_kiriman(uuid) set schema gudang_internal;
alter function gudang_internal.kirim_kiriman(uuid) rename to kirim_asli;
revoke all on function gudang_internal.kirim_asli(uuid) from public,anon,authenticated;
create function gudang_internal.kirim(kid uuid) returns void language plpgsql security definer set search_path='' as $$
declare k public.kiriman;i public.item_kiriman;stok numeric;h numeric;
begin
 if not gudang_internal.boleh(true) then raise exception 'Tidak berwenang mengirim';end if;
 perform pg_advisory_xact_lock(hashtext('gudang-stok:asli'));
 select * into k from public.kiriman where id=kid and mode='asli' and deleted_at is null for update;
 if k.id is null or k.status<>'draft' then raise exception 'Kiriman bukan draft';end if;
 for i in select * from public.item_kiriman where kiriman_id=kid order by bahan_id for update loop
  select nullif(harga_pokok,0) into h from public.bahan where id=i.bahan_id and deleted_at is null for share;
  select coalesce(sum(jumlah),0) into stok from public.stok where mode='asli' and outlet_id is null and bahan_id=i.bahan_id;
  if stok<(select sum(qty*konversi) from public.item_kiriman where kiriman_id=kid and bahan_id=i.bahan_id) then raise exception 'Stok gudang tidak cukup untuk %',i.nama;end if;
  update public.item_kiriman set hpp_gudang=h*i.konversi where id=i.id;
 end loop;
 update public.kiriman set kepemilikan_snapshot=(select kepemilikan from public.outlet where id=k.outlet_id) where id=kid;
 perform gudang_internal.kirim_asli(kid);
end $$;
create function public.kirim_kiriman(p_id uuid) returns void language sql security invoker set search_path='' as $$select gudang_internal.kirim(p_id)$$;

create function gudang_internal.opname(p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare aksi text:=p->>'aksi';oid uuid:=(p->>'id')::uuid;d public.opname_gudang;it public.item_opname_gudang;x jsonb;stok numeric;w timestamptz;j int;v int;
begin
 if not gudang_internal.boleh(true) then raise exception 'Hanya admin gudang/pusat/owner aktif';end if;
 if octet_length(p::text)>500000 then raise exception 'Data terlalu besar';end if;
 if aksi='buat' then
  if (p->>'request_id')::uuid is null then raise exception 'Identitas permintaan wajib';end if;
  select id into oid from public.opname_gudang where request_id=(p->>'request_id')::uuid;
  if oid is not null then return oid;end if;
  if (p->>'tanggal')::date is null or (p->>'tanggal')::date>(now() at time zone 'Asia/Jakarta')::date then raise exception 'Tanggal opname tidak valid';end if;
  perform pg_advisory_xact_lock(hashtext('gudang-stok:asli'));
  select id into oid from public.opname_gudang where request_id=(p->>'request_id')::uuid;
  if oid is not null then return oid;end if;
  if exists(select 1 from public.stok where mode='asli' and outlet_id is null group by bahan_id having count(*)>1) then raise exception 'Ada stok duplikat. Periksa data gudang dahulu';end if;
  insert into public.opname_gudang(request_id,tanggal,dibuat_oleh,nama_petugas) values((p->>'request_id')::uuid,(p->>'tanggal')::date,auth.uid(),(select nama from public.pengguna where id=auth.uid())) returning id into oid;
  insert into public.item_opname_gudang(opname_id,bahan_id,nama,satuan,sistem,stok_at,hpp)
  select oid,b.id,b.nama,b.satuan_pakai,coalesce(s.jumlah,0),s.updated_at,nullif(b.harga_pokok,0) from public.bahan b left join public.stok s on s.bahan_id=b.id and s.mode='asli' and s.outlet_id is null where b.mode='asli' and b.deleted_at is null;
  return oid;
 end if;
 select * into d from public.opname_gudang where id=oid for update;
 if d.id is null then raise exception 'Opname tidak ditemukan';end if;
 if aksi='final' and d.status='final' then return oid;end if;
 if d.status<>'draft' or d.versi is distinct from (p->>'versi')::int then raise exception 'Draft sudah berubah. Muat ulang';end if;
 if aksi='simpan' then
  if jsonb_typeof(p->'items') is distinct from 'array' then raise exception 'Format hitungan tidak valid';end if;
  if exists(select 1 from jsonb_array_elements(p->'items') a group by a->>'bahan_id' having count(*)>1) then raise exception 'Bahan berulang';end if;
  for x in select * from jsonb_array_elements(p->'items') loop
   if x->>'fisik' in ('NaN','Infinity','-Infinity') or (x->>'fisik')::numeric<0 or (x->>'fisik')::numeric>1000000000000 then raise exception 'Jumlah fisik tidak boleh negatif';end if;
   if not exists(select 1 from public.item_opname_gudang where opname_id=oid and bahan_id=(x->>'bahan_id')::uuid) then raise exception 'Bahan bukan milik draft';end if;
   update public.item_opname_gudang set fisik=(x->>'fisik')::numeric,alasan=left(coalesce(x->>'alasan',''),500) where opname_id=oid and bahan_id=(x->>'bahan_id')::uuid;
  end loop;
  update public.opname_gudang set catatan=left(coalesce(p->>'catatan',''),2000),versi=versi+1 where id=oid;
 elsif aksi='batal' then update public.opname_gudang set status='batal',versi=versi+1 where id=oid;
 elsif aksi='final' then
  perform pg_advisory_xact_lock(hashtext('gudang-stok:asli'));
  if not exists(select 1 from public.item_opname_gudang where opname_id=oid and fisik is not null) then raise exception 'Isi minimal satu hasil hitungan';end if;
  for it in select * from public.item_opname_gudang where opname_id=oid and fisik is not null order by bahan_id for update loop
   select jumlah,updated_at into stok,w from public.stok where mode='asli' and outlet_id is null and bahan_id=it.bahan_id for update;
   if coalesce(stok,0) is distinct from it.sistem or w is distinct from it.stok_at then raise exception 'Stok % bergerak sejak draft dibuat. Buat draft baru dan hitung ulang bahan ini',it.nama;end if;
   if it.fisik<>it.sistem and length(trim(it.alasan||d.catatan))<3 then raise exception 'Isi alasan selisih untuk %',it.nama;end if;
   if it.fisik<>it.sistem then perform public.geser_stok('asli',null,it.bahan_id,it.fisik-it.sistem,'opname',oid,'Opname gudang: '||it.alasan);end if;
  end loop;
  update public.opname_gudang set status='final',final_at=clock_timestamp(),versi=versi+1 where id=oid;
 else raise exception 'Aksi tidak dikenal';end if;
 insert into public.log_aktivitas(pengguna_id,aksi,entitas,entitas_id) values(auth.uid(),'opname_gudang_'||aksi,'opname_gudang',oid::text);
 return oid;
end $$;
create function public.proses_opname_gudang(p jsonb) returns uuid language sql security invoker set search_path='' as $$select gudang_internal.opname(p)$$;

create function gudang_internal.biaya(p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare bid uuid;b public.biaya_gudang;
begin
 if not gudang_internal.boleh(true) then raise exception 'Tidak berwenang mengelola biaya gudang';end if;
 if p->>'aksi'='batal' then
  select * into b from public.biaya_gudang where id=(p->>'id')::uuid for update;
  if b.id is null then raise exception 'Biaya tidak ditemukan';end if;
  if length(trim(coalesce(p->>'alasan','')))<3 then raise exception 'Isi alasan pembatalan';end if;
  update public.biaya_gudang set deleted_at=coalesce(deleted_at,now()),alasan_batal=left(p->>'alasan',500) where id=b.id;bid:=b.id;
 else
  if (p->>'request_id')::uuid is null or (p->>'jumlah')::bigint is null or (p->>'jumlah')::bigint<=0 or (p->>'jumlah')::bigint>1000000000000 or length(trim(coalesce(p->>'keterangan','')))<3 or (p->>'tanggal')::date is null then raise exception 'Tanggal, nominal dan keterangan wajib valid';end if;
  insert into public.biaya_gudang(request_id,tanggal,jumlah,keterangan,outlet_id,dibuat_oleh) values((p->>'request_id')::uuid,(p->>'tanggal')::date,(p->>'jumlah')::bigint,left(trim(p->>'keterangan'),500),(p->>'outlet_id')::uuid,auth.uid()) on conflict(request_id) do nothing returning id into bid;
  if bid is null then
   select * into b from public.biaya_gudang where request_id=(p->>'request_id')::uuid;
   if b.jumlah is distinct from (p->>'jumlah')::bigint or b.tanggal is distinct from (p->>'tanggal')::date or b.keterangan is distinct from left(trim(p->>'keterangan'),500) or b.outlet_id is distinct from (p->>'outlet_id')::uuid then raise exception 'Identitas biaya sudah dipakai untuk data berbeda';end if;bid:=b.id;
  end if;
 end if;
 insert into public.log_aktivitas(pengguna_id,aksi,entitas,entitas_id) values(auth.uid(),'biaya_gudang','biaya_gudang',bid::text);return bid;
end $$;
create function public.proses_biaya_gudang(p jsonb) returns uuid language sql security invoker set search_path='' as $$select gudang_internal.biaya(p)$$;

create function gudang_internal.laporan(awal date,akhir date,ol uuid,bh uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare hasil jsonb;
begin
 if not gudang_internal.boleh() then raise exception 'Tidak berwenang membaca laporan gudang';end if;
 if awal is null or akhir is null or akhir<awal or akhir-awal>366 then raise exception 'Pilih periode maksimal 366 hari';end if;
 with penerimaan as (
  select k.id,k.nomor,k.outlet_id,ot.nama outlet,coalesce(k.kepemilikan_snapshot,ot.kepemilikan,'Lainnya') kepemilikan,r.waktu waktu,i.bahan_id,i.nama,i.harga,i.hpp_gudang,(z->>'baik')::numeric qty
  from public.penerimaan_kiriman r join public.kiriman k on k.id=r.kiriman_id join public.outlet ot on ot.id=k.outlet_id cross join lateral jsonb_array_elements(r.items) z join public.item_kiriman i on i.id=(z->>'id')::uuid and i.kiriman_id=k.id
  where k.mode='asli' and k.deleted_at is null and k.status<>'batal'
  union all
  select k.id,k.nomor,k.outlet_id,ot.nama,coalesce(k.kepemilikan_snapshot,ot.kepemilikan,'Lainnya'),k.diterima_at,i.bahan_id,i.nama,i.harga,i.hpp_gudang,i.qty_diterima
  from public.kiriman k join public.item_kiriman i on i.kiriman_id=k.id join public.outlet ot on ot.id=k.outlet_id where k.mode='asli' and k.status='diterima' and k.deleted_at is null and not exists(select 1 from public.penerimaan_kiriman r where r.kiriman_id=k.id)
 ) select jsonb_build_object(
  'rows',coalesce((select jsonb_agg(to_jsonb(x) order by x.waktu desc) from penerimaan x where (x.waktu at time zone 'Asia/Jakarta')::date between awal and akhir and x.qty>0 and (ol is null or x.outlet_id=ol) and (bh is null or x.bahan_id=bh)),'[]'::jsonb),
  'biaya',coalesce((select jsonb_agg(to_jsonb(b) order by b.tanggal desc,b.created_at desc) from public.biaya_gudang b where b.deleted_at is null and b.tanggal between awal and akhir and bh is null and (ol is null or b.outlet_id=ol)),'[]'::jsonb),
  'mutasi',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'nama',b.nama,'jenis',m.jenis,'jumlah',m.jumlah,'hpp',m.hpp_gudang,'tanggal',(m.created_at at time zone 'Asia/Jakarta')::date)) from public.mutasi_stok m join public.bahan b on b.id=m.bahan_id where m.mode='asli' and m.outlet_id is null and m.jenis in ('opname','waste') and (m.created_at at time zone 'Asia/Jakarta')::date between awal and akhir and ol is null and (bh is null or m.bahan_id=bh)),'[]'::jsonb)
 ) into hasil;
 return hasil;
end $$;
create function public.laporan_laba_gudang(p_awal date,p_akhir date,p_outlet uuid default null,p_bahan uuid default null) returns jsonb language sql security invoker set search_path='' as $$select gudang_internal.laporan(p_awal,p_akhir,p_outlet,p_bahan)$$;
revoke all on function gudang_internal.pembuat(),gudang_internal.snapshot_mutasi() from public,anon,authenticated;
revoke all on function gudang_internal.harga(uuid,bigint,bigint),gudang_internal.pemeriksa(uuid,text),gudang_internal.kirim(uuid),gudang_internal.opname(jsonb),gudang_internal.biaya(jsonb),gudang_internal.laporan(date,date,uuid,uuid) from public,anon;
grant execute on function gudang_internal.harga(uuid,bigint,bigint),gudang_internal.pemeriksa(uuid,text),gudang_internal.kirim(uuid),gudang_internal.opname(jsonb),gudang_internal.biaya(jsonb),gudang_internal.laporan(date,date,uuid,uuid) to authenticated;
revoke all on function public.atur_harga_jual_gudang(uuid,bigint,bigint),public.atur_pemeriksa_kiriman(uuid,text),public.kirim_kiriman(uuid),public.proses_opname_gudang(jsonb),public.proses_biaya_gudang(jsonb),public.laporan_laba_gudang(date,date,uuid,uuid) from public,anon;
grant execute on function public.atur_harga_jual_gudang(uuid,bigint,bigint),public.atur_pemeriksa_kiriman(uuid,text),public.kirim_kiriman(uuid),public.proses_opname_gudang(jsonb),public.proses_biaya_gudang(jsonb),public.laporan_laba_gudang(date,date,uuid,uuid) to authenticated;
