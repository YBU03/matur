-- Existing outlets retain the shared catalogue; future outlets start empty.
create table public.brand (
 id uuid primary key default gen_random_uuid(), mode public.mode_data not null default 'asli',
 nama text not null check(length(trim(nama)) between 1 and 120),
 konsep text, deleted_at timestamptz
);
alter table public.brand enable row level security;
create trigger log_brand after insert or update or delete on public.brand for each row execute function public.catat_log();
grant select,insert,update on public.brand to authenticated;
create policy brand_read on public.brand for select to authenticated using ((select auth.uid()) is not null);
create policy brand_add on public.brand for insert to authenticated with check ((select public.punya_peran('{owner,admin_pusat}')));
create policy brand_edit on public.brand for update to authenticated using ((select public.punya_peran('{owner,admin_pusat}'))) with check ((select public.punya_peran('{owner,admin_pusat}')));
alter table public.outlet add column brand_id uuid references public.brand(id), add column konsep text,
 add column katalog_bersama boolean not null default false;
update public.outlet set katalog_bersama=true;
insert into public.brand(nama,konsep) values('RUMA','Kedai kopi');
update public.outlet set brand_id=(select id from public.brand where nama='RUMA'),konsep='Kedai kopi' where nama ilike '%ruma%' and deleted_at is null;
create index outlet_brand_idx on public.outlet(brand_id);
alter table public.menu add column outlet_id uuid references public.outlet(id);
create index menu_outlet_idx on public.menu(outlet_id);

create schema if not exists usaha_internal;
revoke all on schema usaha_internal from public,anon;
grant usage on schema usaha_internal to authenticated;
create function usaha_internal.menu_boleh(o uuid,m uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.menu x join public.outlet ot on ot.id=o
 where x.id=m and x.mode=ot.mode and ot.deleted_at is null and (x.outlet_id=o or (x.outlet_id is null and ot.katalog_bersama)))
$$;
revoke all on function usaha_internal.menu_boleh(uuid,uuid) from public,anon,authenticated;

create function matur_internal.katalog_pos(o uuid) returns jsonb language sql stable security definer set search_path=public,extensions as $$
 select jsonb_build_object('menu',(select coalesce(jsonb_object_agg(id::text,jsonb_build_object('langsung',harga_langsung,'ojol',harga_ojol)),'{}') from menu where mode='asli' and aktif and deleted_at is null and usaha_internal.menu_boleh(o,id)),
 'varian',(select coalesce(jsonb_object_agg(id::text,tambahan_harga),'{}') from varian where mode='asli' and deleted_at is null and usaha_internal.menu_boleh(o,menu_id)),
 'resep_hash',encode(digest(coalesce((select jsonb_agg(to_jsonb(r)-'outlet_id' order by r.id)::text from resep r where mode='asli' and deleted_at is null and usaha_internal.menu_boleh(o,r.menu_id)),'[]')||coalesce((select jsonb_agg(jsonb_build_array(id,harga_pokok) order by id)::text from bahan where mode='asli' and deleted_at is null),'[]')||coalesce((select jsonb_agg(jsonb_build_array(id,titipan,harga_titip) order by id)::text from menu where mode='asli' and deleted_at is null and usaha_internal.menu_boleh(o,id)),'[]'),'sha256'),'hex')) where auth.uid() is not null
$$;
revoke all on function matur_internal.katalog_pos(uuid) from public,anon,authenticated;

-- Reject a cross-outlet menu at the actual transaction boundary, including stale leases.
do $patch$
declare d text; old text:='  if not peran_di_outlet(v_outlet, ''{kasir,barista,spv}'') then';
begin
 d:=pg_get_functiondef('matur_internal.buat_transaksi(jsonb)'::regprocedure);
 if position(old in d)=0 then raise exception 'Transaction guard changed; review required';end if;
 d:=replace(d,old,'  if exists(select 1 from jsonb_array_elements(coalesce(p->''items'',''[]'')) x where not usaha_internal.menu_boleh(v_outlet,(x->>''menu_id'')::uuid)) then raise exception ''Menu bukan katalog outlet ini'';end if;'||chr(10)||old);
 execute d;
end $patch$;

-- Isolated menu ownership cannot silently be reassigned after it is created.
create function usaha_internal.jaga_menu() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and new.outlet_id is distinct from old.outlet_id then raise exception 'Pindah outlet tidak diperbolehkan; salin menu melalui pengaturan usaha';end if;
 if tg_op='INSERT' and new.induk_id is not null and new.outlet_id is null then select m.outlet_id into new.outlet_id from public.menu m where m.id=new.induk_id;end if;
 if new.induk_id is not null and not exists(select 1 from public.menu m where m.id=new.induk_id and m.outlet_id is not distinct from new.outlet_id) then raise exception 'Kemasan harus satu katalog dengan menu induk';end if;
 return new;
end $$;
revoke all on function usaha_internal.jaga_menu() from public,anon,authenticated;
create trigger usaha_menu_guard before insert or update on public.menu for each row execute function usaha_internal.jaga_menu();

create table usaha_internal.perintah(id uuid primary key,pengguna_id uuid not null,payload jsonb not null,hasil jsonb not null);
alter table usaha_internal.perintah enable row level security;
revoke all on usaha_internal.perintah from public,anon,authenticated;

-- Copy an independent menu/variant/recipe graph; no stock, prices in past receipts,
-- payments, promotions, user assignments or financial postings are copied.
create function usaha_internal.salin(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare o uuid:=(p->>'outlet_id')::uuid; asal uuid:=nullif(p->>'asal','')::uuid;
 ot public.outlet; m public.menu; v public.varian; r public.resep; baru uuid;
 mm jsonb:='{}'; vm jsonb:='{}'; n int:=0; req uuid:=(p->>'request_id')::uuid; prev usaha_internal.perintah; result jsonb;
begin
 if auth.uid() is null or not public.punya_peran('{owner,admin_pusat}') then raise exception 'Hanya Admin Pusat/Owner';end if;
 if req is null then raise exception 'Identitas permintaan wajib';end if;
 perform pg_advisory_xact_lock(hashtext('usaha-request:'||req));
 select * into prev from usaha_internal.perintah where id=req;
 if found then
  if prev.pengguna_id<>auth.uid() or prev.payload<>p then raise exception 'ID permintaan sudah dipakai';end if;
  return prev.hasil;
 end if;
 select * into ot from public.outlet where id=o and mode='asli' and deleted_at is null for update;
 if ot.id is null or asal=o then raise exception 'Outlet tujuan/sumber tidak valid';end if;
 if exists(select 1 from public.menu where outlet_id=o) or exists(select 1 from public.transaksi where outlet_id=o) then raise exception 'Mulai kosong/salin hanya untuk outlet tanpa menu khusus dan tanpa riwayat penjualan';end if;
 if asal is not null and not exists(select 1 from public.outlet where id=asal and mode='asli' and deleted_at is null) then raise exception 'Outlet sumber tidak ditemukan';end if;
 if asal is not null then
  perform pg_advisory_xact_lock(hashtext('salin-katalog:'||asal));
  if exists(select 1 from public.menu src where src.mode='asli' and src.deleted_at is null and usaha_internal.menu_boleh(asal,src.id) and src.induk_id is not null and not exists(select 1 from public.menu parent where parent.id=src.induk_id and parent.deleted_at is null and parent.induk_id is null and usaha_internal.menu_boleh(asal,parent.id))) then raise exception 'Struktur kemasan sumber perlu diperbaiki terlebih dahulu';end if;
  for m in select * from public.menu where mode='asli' and deleted_at is null and usaha_internal.menu_boleh(asal,id) order by (induk_id is not null),id loop
   baru:=gen_random_uuid();mm:=mm||jsonb_build_object(m.id::text,baru);
   insert into public.menu(id,mode,nama,kategori_id,harga_langsung,harga_ojol,aktif,foto_url,urutan,titipan,produsen,harga_titip,produsen_id,induk_id,kemasan,outlet_id)
   values(baru,m.mode,m.nama,m.kategori_id,m.harga_langsung,m.harga_ojol,m.aktif,m.foto_url,m.urutan,m.titipan,m.produsen,m.harga_titip,m.produsen_id,(mm->>m.induk_id::text)::uuid,m.kemasan,o);
   n:=n+1;
  end loop;
  for v in select * from public.varian where mode='asli' and deleted_at is null and mm ? menu_id::text loop
   baru:=gen_random_uuid();vm:=vm||jsonb_build_object(v.id::text,baru);
   insert into public.varian(id,mode,menu_id,grup,nama,tambahan_harga) values(baru,v.mode,(mm->>v.menu_id::text)::uuid,v.grup,v.nama,v.tambahan_harga);
  end loop;
  for r in select * from public.resep where mode='asli' and deleted_at is null and mm ? menu_id::text loop
   if r.varian_id is not null and not vm ? r.varian_id::text then raise exception 'Resep sumber menunjuk varian yang sudah dihapus';end if;
   insert into public.resep(mode,menu_id,varian_id,bahan_id,takaran) values(r.mode,(mm->>r.menu_id::text)::uuid,(vm->>r.varian_id::text)::uuid,r.bahan_id,r.takaran);
  end loop;
  insert into public.hpp_menu(menu_id,nama_hpp,seri,komponen,total_hpp,harga_jual)
  select (mm->>menu_id::text)::uuid,nama_hpp,seri,komponen,total_hpp,harga_jual from public.hpp_menu where deleted_at is null and mm ? menu_id::text;
  insert into public.isi_titipan(menu_id,barang_id,qty) select (mm->>menu_id::text)::uuid,barang_id,qty from public.isi_titipan where mm ? menu_id::text;
 end if;
 update public.outlet set katalog_bersama=false where id=o;
 insert into public.log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_baru) values(auth.uid(),'siapkan_katalog_outlet','outlet',o::text,jsonb_build_object('sumber',asal,'jumlah_menu',n));
 result:=jsonb_build_object('jumlah_menu',n);
 insert into usaha_internal.perintah values(req,auth.uid(),p,result);
 return result;
end $$;
revoke all on function usaha_internal.salin(jsonb) from public,anon;
grant execute on function usaha_internal.salin(jsonb) to authenticated;
create function public.salin_katalog_outlet(p jsonb) returns jsonb language sql security invoker set search_path='' as $$select usaha_internal.salin(p)$$;
revoke all on function public.salin_katalog_outlet(jsonb) from public,anon;
grant execute on function public.salin_katalog_outlet(jsonb) to authenticated;

-- Update only known catalogue call sites, preserving all other POS logic.
do $patch$
declare r record;d text;arg text;
begin
 for r in select n.nspname,p.proname,p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.prosrc like '%matur_internal.katalog_pos()%' loop
  arg:=case when r.proname in ('checkout_lama','checkout_langsung','siapkan_langsung') then 'o' when r.proname in ('buka_pos_tim','status_pos_lama','pilih_pic_pos_outlet') then 'p_outlet' end;
  if arg is null then raise exception 'Unknown catalogue caller %.%',r.nspname,r.proname;end if;
  d:=pg_get_functiondef(r.oid);execute replace(d,'matur_internal.katalog_pos()','matur_internal.katalog_pos('||arg||')');
 end loop;
end $patch$;
-- Testing legacy catalogue must not leak new outlet-specific menus.
create or replace function matur_internal.katalog_pos() returns jsonb language sql stable security definer set search_path=public,extensions as $$
 select jsonb_build_object('menu',(select coalesce(jsonb_object_agg(id::text,jsonb_build_object('langsung',harga_langsung,'ojol',harga_ojol)),'{}') from menu where mode='asli' and aktif and deleted_at is null and outlet_id is null),
 'varian',(select coalesce(jsonb_object_agg(v.id::text,v.tambahan_harga),'{}') from varian v join menu m on m.id=v.menu_id where v.mode='asli' and v.deleted_at is null and m.outlet_id is null),
 'resep_hash',encode(digest(coalesce((select jsonb_agg(to_jsonb(r) order by r.id)::text from resep r join menu m on m.id=r.menu_id where r.mode='asli' and r.deleted_at is null and m.outlet_id is null),'[]')||coalesce((select jsonb_agg(jsonb_build_array(id,harga_pokok) order by id)::text from bahan where mode='asli' and deleted_at is null),'[]')||coalesce((select jsonb_agg(jsonb_build_array(id,titipan,harga_titip) order by id)::text from menu where mode='asli' and deleted_at is null and outlet_id is null),'[]'),'sha256'),'hex')) where auth.uid() is not null
$$;
revoke all on function matur_internal.katalog_pos() from public,anon,authenticated;
