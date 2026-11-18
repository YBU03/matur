-- Promo online: harga/kuota ditetapkan server, reservasi sebelum QR ditampilkan.
create schema promo_internal;
revoke all on schema promo_internal from public,anon,authenticated;
grant usage on schema promo_internal to authenticated;
create table promo_internal.promo (
 id uuid primary key default gen_random_uuid(), nama text not null check(length(nama) between 1 and 120),
 aktif boolean not null default false, mulai date not null, selesai date not null check(selesai>=mulai),
 jam_mulai time not null default '00:00', jam_selesai time not null default '23:59:59' check(jam_selesai>jam_mulai),
 semua_outlet boolean not null default false, outlet_ids uuid[] not null default '{}',
 aturan jsonb not null, kuota integer check(kuota>0), per_menu boolean not null default false,
 bersama boolean not null default false, boleh_manual boolean not null default false,
 versi integer not null default 1, diubah_at timestamptz not null default now(), diubah_oleh uuid not null references public.pengguna(id)
);
create table promo_internal.pesanan (
 id uuid primary key default gen_random_uuid(), promo_id uuid not null references promo_internal.promo(id),
 pengguna_id uuid not null references public.pengguna(id), outlet_id uuid not null references public.outlet(id),
 sesi_id uuid not null references public.sesi_kas(id), izin_id uuid not null,
 tanggal date not null, sampai_at timestamptz not null, status text not null default 'pesan' check(status in ('pesan','pakai','lepas')),
 keranjang jsonb not null, katalog jsonb not null, subtotal bigint not null, diskon bigint not null check(diskon>0),
 rincian jsonb not null, snapshot jsonb not null, transaksi_id uuid unique references public.transaksi(id), dibuat_at timestamptz not null default now()
);
create index promo_pesanan_kuota on promo_internal.pesanan(promo_id,tanggal,outlet_id,status,sampai_at);
alter table promo_internal.promo enable row level security;
alter table promo_internal.pesanan enable row level security;
alter table public.transaksi add column promo_snapshot jsonb;

create function promo_internal.pusat() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.pengguna u where u.id=auth.uid() and u.status='aktif')
 and public.punya_peran('{owner,admin_pusat,admin_gudang,hrd}');
$$;
create function promo_internal.kelola(o uuid) returns boolean language sql stable security definer set search_path='' as $$
 select promo_internal.pusat() or (auth.uid() is not null and exists(select 1 from public.pengguna u where u.id=auth.uid() and u.status='aktif') and public.peran_di_outlet(o,'{spv}'));
$$;
create function promo_internal.akses(o uuid) returns boolean language sql stable security definer set search_path='' as $$
 select promo_internal.kelola(o) or (auth.uid() is not null and exists(select 1 from public.pengguna u where u.id=auth.uid() and u.status='aktif') and (public.punya_peran('{finance}') or public.peran_di_outlet(o,'{kasir,barista}')));
$$;
create function promo_internal.simpan(p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare x promo_internal.promo; lama jsonb; ids uuid[]; a jsonb; vid uuid; mid uuid; n integer;
begin
 if auth.uid() is null then raise exception 'Masuk terlebih dahulu'; end if;
 ids:=coalesce((select array_agg(distinct v::uuid) from jsonb_array_elements_text(p->'outlet_ids') v),'{}');
 if not promo_internal.pusat() then
  if coalesce((p->>'semua_outlet')::boolean,false) or cardinality(ids)<>1 or not promo_internal.kelola(ids[1]) then raise exception 'SPV hanya boleh mengatur outlet sendiri'; end if;
 end if;
 if cardinality(ids)=0 and not coalesce((p->>'semua_outlet')::boolean,false) then raise exception 'Pilih minimal satu outlet'; end if;
 if exists(select 1 from unnest(ids) v where not exists(select 1 from public.outlet o where o.id=v and o.deleted_at is null)) then raise exception 'Outlet tidak tersedia'; end if;
 if jsonb_typeof(p->'aturan') is distinct from 'array' or jsonb_array_length(p->'aturan') not between 1 and 200 then raise exception 'Tambahkan aturan menu (maksimal 200)'; end if;
 if (select count(distinct v->>'menu_id') from jsonb_array_elements(p->'aturan') v)<>jsonb_array_length(p->'aturan') then raise exception 'Satu aturan per menu/kemasan'; end if;
 for a in select * from jsonb_array_elements(p->'aturan') loop
  mid:=(a->>'menu_id')::uuid; n:=(a->>'nilai')::integer;
  if mid is null or not exists(select 1 from public.menu where id=mid and aktif and deleted_at is null and mode='asli') then raise exception 'Menu tidak tersedia'; end if;
  if a->>'jenis' is null or a->>'jenis' not in ('persen','potongan','harga_akhir') or n is null or n<=0 or (a->>'jenis'='persen' and n>100) then raise exception 'Nilai promo tidak valid'; end if;
  if jsonb_typeof(coalesce(a->'varian_ids','[]'))<>'array' then raise exception 'Varian tidak valid'; end if;
  for vid in select v::uuid from jsonb_array_elements_text(coalesce(a->'varian_ids','[]')) v loop
   if not exists(select 1 from public.varian where id=vid and menu_id=mid and deleted_at is null) then raise exception 'Varian tidak sesuai menu'; end if;
  end loop;
 end loop;
 if nullif(p->>'id','') is not null then
  select * into x from promo_internal.promo where id=(p->>'id')::uuid for update;
  if x.id is null then raise exception 'Promo tidak ditemukan'; end if;
  if not promo_internal.pusat() and (x.semua_outlet or cardinality(x.outlet_ids)<>1 or not promo_internal.kelola(x.outlet_ids[1])) then raise exception 'Tidak berwenang mengubah promo ini'; end if;
  if x.versi is distinct from (p->>'versi')::integer then raise exception 'Promo diubah pengguna lain. Muat ulang'; end if;
  lama:=to_jsonb(x);
 else x.id:=gen_random_uuid(); x.versi:=0; end if;
 insert into promo_internal.promo(id,nama,aktif,mulai,selesai,jam_mulai,jam_selesai,semua_outlet,outlet_ids,aturan,kuota,per_menu,bersama,boleh_manual,versi,diubah_oleh)
 values(x.id,trim(p->>'nama'),coalesce((p->>'aktif')::boolean,false),(p->>'mulai')::date,(p->>'selesai')::date,
 (p->>'jam_mulai')::time,(p->>'jam_selesai')::time,coalesce((p->>'semua_outlet')::boolean,false),ids,p->'aturan',nullif(p->>'kuota','')::integer,
 coalesce((p->>'per_menu')::boolean,false),coalesce((p->>'bersama')::boolean,false),coalesce((p->>'boleh_manual')::boolean,false),x.versi+1,auth.uid())
 on conflict(id) do update set nama=excluded.nama,aktif=excluded.aktif,mulai=excluded.mulai,selesai=excluded.selesai,jam_mulai=excluded.jam_mulai,jam_selesai=excluded.jam_selesai,semua_outlet=excluded.semua_outlet,outlet_ids=excluded.outlet_ids,aturan=excluded.aturan,kuota=excluded.kuota,per_menu=excluded.per_menu,bersama=excluded.bersama,boleh_manual=excluded.boleh_manual,versi=excluded.versi,diubah_at=now(),diubah_oleh=auth.uid();
 insert into public.log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_lama,nilai_baru) select auth.uid(),'atur_promo','promo',x.id::text,lama,to_jsonb(r) from promo_internal.promo r where r.id=x.id;
 return x.id;
end $$;
create function promo_internal.daftar(o uuid, manajemen boolean) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if manajemen then
  if not (promo_internal.kelola(o) or (promo_internal.akses(o) and public.punya_peran('{finance}'))) then raise exception 'Tidak diizinkan'; end if;
 else if not promo_internal.akses(o) then raise exception 'Tidak diizinkan'; end if; end if;
 return coalesce((select jsonb_agg(to_jsonb(r)-'diubah_oleh' order by r.diubah_at desc) from promo_internal.promo r
 where (case when manajemen then (promo_internal.pusat() or public.punya_peran('{finance}') or (not r.semua_outlet and cardinality(r.outlet_ids)=1 and promo_internal.kelola(r.outlet_ids[1]))) else r.aktif and (r.semua_outlet or o=any(r.outlet_ids)) and (now() at time zone 'Asia/Jakarta')::date between r.mulai and r.selesai and (now() at time zone 'Asia/Jakarta')::time between r.jam_mulai and r.jam_selesai end)), '[]');
end $$;
-- Only relevant price-affecting inputs are bound. Notes/customer/payment may change without changing the price.
create function promo_internal.keranjang(p jsonb) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('items',(select jsonb_agg(jsonb_build_object('menu_id',i->>'menu_id','qty',(i->>'qty')::integer,'varian_ids',coalesce((select jsonb_agg(v order by v) from jsonb_array_elements_text(coalesce(i->'varian_ids','[]')) v),'[]')) order by ord) from jsonb_array_elements(p->'items') with ordinality a(i,ord)), 'kanal',p->>'kanal','diskon',greatest(coalesce((p->>'diskon')::bigint,0),0));
$$;
create function promo_internal.cek_kuota(x promo_internal.promo,o uuid,d date,qty jsonb,abaikan uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare a record; terpakai bigint; sisa bigint; hasil jsonb:='{}';
begin
 if x.kuota is null then return '{}'::jsonb; end if;
 for a in select key, value::integer n from jsonb_each_text(case when x.per_menu then qty else jsonb_build_object('semua',(select sum(v::integer) from jsonb_each_text(qty) t(k,v))) end) loop
  select coalesce(sum(case when x.per_menu then coalesce((r.rincian->>a.key)::integer,0) else (select sum(v::integer) from jsonb_each_text(r.rincian) t(k,v)) end),0)
  into terpakai from promo_internal.pesanan r where r.promo_id=x.id and r.tanggal=d and (x.bersama or r.outlet_id=o)
   and (abaikan is null or r.id<>abaikan) and (r.status='pakai' or (r.status='pesan' and r.sampai_at>clock_timestamp()));
  sisa:=greatest(x.kuota-terpakai,0);
  if a.n>sisa then raise exception 'Kuota promo tidak cukup (sisa %). Kurangi jumlah atau pilih promo lain',sisa; end if;
  hasil:=hasil||jsonb_build_object(a.key,sisa-a.n);
 end loop;
 return hasil;
end $$;
create function promo_internal.pesan(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare x promo_internal.promo; iz matur_internal.pos_izin; o uuid:=(p->>'outlet_id')::uuid; dev uuid; it jsonb; a jsonb; vids uuid[]; harga bigint; unit_diskon bigint; sub bigint:=0; pot bigint:=0; rin jsonb:='{}'; k jsonb; r promo_internal.pesanan; sisa jsonb; lokal timestamp:=clock_timestamp() at time zone 'Asia/Jakarta';
begin
 if not promo_internal.akses(o) then raise exception 'Tidak diizinkan'; end if;
 if coalesce((p->>'sinkron_offline')::boolean,false) then raise exception 'Promo membutuhkan internet'; end if;
 dev:=pos_kas_internal.perangkat_langsung(o,p->>'device_token');
 select * into iz from matur_internal.pos_izin where id=(p->>'izin_id')::uuid and sesi_id=(p->>'sesi_id')::uuid and perangkat_id=dev;
 if iz.id is null or iz.ditarik_at is not null or iz.sampai_at<=clock_timestamp() or iz.token_hash is distinct from encode(extensions.digest(p->>'pos_token','sha256'),'hex') or not exists(select 1 from public.sesi_kas where id=iz.sesi_id and outlet_id=o and ditutup_at is null) then raise exception 'Sesi POS berubah. Muat ulang kasir'; end if;
 select * into x from promo_internal.promo where id=(p->>'promo_id')::uuid for update;
 if x.id is null or not x.aktif or not (x.semua_outlet or o=any(x.outlet_ids)) or lokal::date not between x.mulai and x.selesai or lokal::time not between x.jam_mulai and x.jam_selesai then raise exception 'Promo tidak aktif untuk outlet/waktu ini'; end if;
 if not x.boleh_manual and coalesce((p->>'diskon')::bigint,0)>0 then raise exception 'Promo ini tidak dapat digabung diskon manual'; end if;
 if jsonb_typeof(p->'items') is distinct from 'array' or jsonb_array_length(p->'items') not between 1 and 200 then raise exception 'Keranjang tidak valid'; end if;
 k:=promo_internal.keranjang(p);
 -- Explicit retry ID prevents duplicate reservations after a lost response.
 select * into r from promo_internal.pesanan where id=(p->>'request_id')::uuid;
 if r.id is not null then
  if r.pengguna_id<>auth.uid() or r.promo_id<>x.id or r.outlet_id<>o or r.keranjang<>k or r.izin_id<>iz.id then raise exception 'ID reservasi sudah digunakan'; end if;
  if r.status<>'pesan' or r.sampai_at<=clock_timestamp() then raise exception 'Reservasi berakhir. Pilih promo kembali'; end if;
  return jsonb_build_object('id',r.id,'nama',r.snapshot->>'nama','diskon',r.diskon,'subtotal',r.subtotal,'sampai_at',r.sampai_at,'sisa',r.snapshot->'sisa');
 end if;
 for it in select * from jsonb_array_elements(p->'items') loop
  if (it->>'qty')::integer is null or (it->>'qty')::integer not between 1 and 999 then raise exception 'Jumlah tidak valid'; end if;
  if iz.katalog#>array['menu',it->>'menu_id'] is null or not exists(select 1 from public.menu where id=(it->>'menu_id')::uuid and aktif and deleted_at is null and mode='asli') then raise exception 'Menu tidak tersedia'; end if;
  vids:=coalesce((select array_agg(v::uuid) from jsonb_array_elements_text(coalesce(it->'varian_ids','[]')) v),'{}');
  perform matur_internal.cek_varian_berulang((it->>'menu_id')::uuid,vids);
  if exists(select 1 from unnest(vids) v where iz.katalog#>array['varian',v::text] is null or not exists(select 1 from public.varian where id=v and menu_id=(it->>'menu_id')::uuid and deleted_at is null)) then raise exception 'Varian tidak tersedia'; end if;
  harga:=(iz.katalog#>>array['menu',it->>'menu_id',case when p->>'kanal' in ('gofood','grabfood','shopeefood','tiktok') then 'ojol' else 'langsung' end])::bigint + coalesce((select sum((iz.katalog#>>array['varian',v::text])::bigint) from unnest(vids) v),0);
  sub:=sub+harga*(it->>'qty')::integer;
  select v into a from jsonb_array_elements(x.aturan) v where v->>'menu_id'=it->>'menu_id' and coalesce((select array_agg(w::uuid) from jsonb_array_elements_text(coalesce(v->'varian_ids','[]')) w),'{}') <@ vids;
  if a is not null then
   unit_diskon:=case a->>'jenis' when 'persen' then floor(harga*(a->>'nilai')::numeric/100)::bigint when 'potongan' then least(harga,(a->>'nilai')::bigint) else greatest(harga-(a->>'nilai')::bigint,0) end;
   if unit_diskon>0 then pot:=pot+unit_diskon*(it->>'qty')::integer; rin:=rin||jsonb_build_object(it->>'menu_id',coalesce((rin->>(it->>'menu_id'))::integer,0)+(it->>'qty')::integer); end if;
  end if;
 end loop;
 if pot<=0 then raise exception 'Tidak ada item yang memenuhi promo'; end if;
 if sub-pot-greatest(coalesce((p->>'diskon')::bigint,0),0)<=0 then raise exception 'Total pembayaran harus lebih dari nol'; end if;
 sisa:=promo_internal.cek_kuota(x,o,public.tgl_op(clock_timestamp()),rin);
 r.id:=(p->>'request_id')::uuid;
 r.sampai_at:=least(clock_timestamp()+interval '15 minutes',(lokal::date+x.jam_selesai) at time zone 'Asia/Jakarta',public.awal_op(public.tgl_op(clock_timestamp())+1));
 insert into promo_internal.pesanan(id,promo_id,pengguna_id,outlet_id,sesi_id,izin_id,tanggal,sampai_at,keranjang,katalog,subtotal,diskon,rincian,snapshot)
 values(r.id,x.id,auth.uid(),o,iz.sesi_id,iz.id,public.tgl_op(clock_timestamp()),r.sampai_at,k,iz.katalog,sub,pot,rin,jsonb_build_object('id',x.id,'nama',x.nama,'versi',x.versi,'aturan',x.aturan,'diskon',pot,'sisa',sisa));
 return jsonb_build_object('id',r.id,'nama',x.nama,'diskon',pot,'subtotal',sub,'sampai_at',r.sampai_at,'sisa',sisa);
end $$;
create function promo_internal.lepas(i uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Masuk terlebih dahulu'; end if;
 -- Same lock order as consumption: promo, reservation.
 perform 1 from promo_internal.promo where id=(select promo_id from promo_internal.pesanan where id=i and pengguna_id=auth.uid()) for update;
 update promo_internal.pesanan set status='lepas' where id=i and pengguna_id=auth.uid() and status='pesan';
end $$;
-- Called only from the price engine. Never exposed as a public RPC.
create function promo_internal.ambil(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r promo_internal.pesanan;
begin
 select * into r from promo_internal.pesanan where id=(p->>'promo_quote')::uuid;
 if r.id is null or r.pengguna_id is distinct from auth.uid() or r.outlet_id is distinct from (p->>'outlet_id')::uuid or r.sesi_id is distinct from (p->>'sesi_id')::uuid or r.izin_id is distinct from (p->>'izin_id')::uuid or r.keranjang is distinct from promo_internal.keranjang(p) or coalesce((p->>'sinkron_offline')::boolean,false) then raise exception 'Reservasi promo tidak sesuai keranjang/sesi'; end if;
 perform 1 from promo_internal.promo where id=r.promo_id for update;
 select * into r from promo_internal.pesanan where id=r.id for update;
 if r.status<>'pesan' or r.sampai_at<=clock_timestamp() then raise exception 'Reservasi promo berakhir. Pilih promo kembali'; end if;
 return to_jsonb(r);
end $$;
create function promo_internal.pakai(p jsonb,t uuid,sub bigint) returns bigint language plpgsql security definer set search_path='' as $$
declare r promo_internal.pesanan;
begin
 select * into r from promo_internal.pesanan where id=(p->>'promo_quote')::uuid for update;
 if r.id is null or r.pengguna_id is distinct from auth.uid() or r.status<>'pesan' or r.subtotal<>sub or r.sampai_at<=clock_timestamp() then raise exception 'Harga/reservasi promo berubah. Pilih kembali'; end if;
 update promo_internal.pesanan set status='pakai',transaksi_id=t where id=r.id;
 update public.transaksi set promo_snapshot=r.snapshot where id=t;
 return r.diskon;
end $$;
create function promo_internal.status_transaksi() returns trigger language plpgsql security definer set search_path='' as $$
declare r promo_internal.pesanan; x promo_internal.promo;
begin
 if old.status is not distinct from new.status then return new; end if;
 select * into r from promo_internal.pesanan where transaksi_id=new.id;
 if r.id is null then return new; end if;
 select * into x from promo_internal.promo where id=r.promo_id for update;
 if new.status in ('void','dihapus') then
  update promo_internal.pesanan set status='lepas' where id=r.id and status='pakai';
 elsif new.status='lunas' and old.status in ('void','dihapus') then
  perform promo_internal.cek_kuota(x,r.outlet_id,r.tanggal,r.rincian,r.id);
  update promo_internal.pesanan set status='pakai' where id=r.id;
 end if;
 return new;
end $$;
create trigger promo_status after update of status on public.transaksi for each row execute function promo_internal.status_transaksi();
create function promo_internal.laporan(o uuid,d date,s date) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if d is null or s is null or s<d or s-d>366 then raise exception 'Pilih periode maksimal 366 hari'; end if;
 if not (promo_internal.kelola(o) or (promo_internal.akses(o) and public.punya_peran('{finance}'))) then raise exception 'Tidak diizinkan'; end if;
 return coalesce((select jsonb_agg(z order by z->>'waktu' desc) from (
  select jsonb_build_object('id',t.id,'nomor',t.nomor,'waktu',t.created_at,'tanggal',r.tanggal,'outlet',ol.nama,'promo',r.snapshot->>'nama','diskon',r.diskon,'subtotal',t.subtotal,'total',t.total,'status',t.status,'qty',(select sum(v::integer) from jsonb_each_text(r.rincian) a(k,v))) z
  from promo_internal.pesanan r join public.transaksi t on t.id=r.transaksi_id join public.outlet ol on ol.id=t.outlet_id
  where r.tanggal between d and s and (o is null or t.outlet_id=o) and (promo_internal.pusat() or public.punya_peran('{finance}') or promo_internal.kelola(t.outlet_id))
 ) a),'[]');
end $$;
-- API wrappers: invoker only. Internal entrypoints guard the account and outlet.
create function public.simpan_promo(p jsonb) returns uuid language sql security invoker set search_path='' as $$select promo_internal.simpan(p)$$;
create function public.daftar_promo(o uuid,manajemen boolean default false) returns jsonb language sql security invoker set search_path='' as $$select promo_internal.daftar(o,manajemen)$$;
create function public.pesan_promo(p jsonb) returns jsonb language sql security invoker set search_path='' as $$select promo_internal.pesan(p)$$;
create function public.lepas_promo(i uuid) returns void language sql security invoker set search_path='' as $$select promo_internal.lepas(i)$$;
create function public.laporan_promo(o uuid,d date,s date) returns jsonb language sql security invoker set search_path='' as $$select promo_internal.laporan(o,d,s)$$;
revoke all on all functions in schema promo_internal from public,anon,authenticated;
grant execute on function promo_internal.simpan(jsonb),promo_internal.daftar(uuid,boolean),promo_internal.pesan(jsonb),promo_internal.lepas(uuid),promo_internal.laporan(uuid,date,date) to authenticated;
revoke all on function public.simpan_promo(jsonb),public.daftar_promo(uuid,boolean),public.pesan_promo(jsonb),public.lepas_promo(uuid),public.laporan_promo(uuid,date,date) from public,anon;
grant execute on function public.simpan_promo(jsonb),public.daftar_promo(uuid,boolean),public.pesan_promo(jsonb),public.lepas_promo(uuid),public.laporan_promo(uuid,date,date) to authenticated;
-- Surgical patch; abort if the expected price/authorization engine changed.
do $patch$
declare f text; lama text; baru text;
begin
 f:=pg_get_functiondef('matur_internal.buat_transaksi(jsonb)'::regprocedure);
 lama:='v_total bigint;'; baru:='v_promo bigint := 0; v_quote jsonb; v_total bigint;';
 if strpos(f,lama)=0 then raise exception 'Promo: declaration anchor missing'; end if; f:=replace(f,lama,baru);
 lama:='  v_id := gen_random_uuid();'; baru:=$code$  if nullif(p->>'promo_quote','') is not null then
    v_quote := promo_internal.ambil(p);
    p := p || jsonb_build_object('_katalog',v_quote->'katalog');
  end if;
  v_id := gen_random_uuid();$code$;
 if strpos(f,lama)=0 then raise exception 'Promo: catalog anchor missing'; end if; f:=replace(f,lama,baru);
 lama:='  select batas_diskon_persen into v_batas from perusahaan limit 1;'; baru:=$code$  if nullif(p->>'promo_quote','') is not null then
    v_promo := promo_internal.pakai(p,v_id,v_sub);
  end if;
  select batas_diskon_persen into v_batas from perusahaan limit 1;$code$;
 if strpos(f,lama)=0 then raise exception 'Promo: discount anchor missing'; end if; f:=replace(f,lama,baru);
 f:=replace(f,'if v_diskon > v_sub then','if v_diskon + v_promo > v_sub then');
 f:=replace(f,'v_diskon * 100 > v_sub *','v_diskon * 100 > (v_sub - v_promo) *');
 lama:='  v_total := v_sub - v_diskon;'; baru:='  v_diskon := v_diskon + v_promo; v_total := v_sub - v_diskon;';
 if strpos(f,lama)=0 then raise exception 'Promo: total anchor missing'; end if; f:=replace(f,lama,baru);
 execute f;
end $patch$;
