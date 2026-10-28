-- Kemasan menu (Cup/Hot/Can, harga sendiri) = anak menu; Gula/Extra disinkronkan ke semua kemasan.
-- Mesin transaksi POS tidak berubah: anak menu adalah menu biasa dengan harga & resep sendiri.
alter table public.menu
  add column induk_id uuid references public.menu(id),
  add column kemasan text,
  add constraint menu_kemasan_cek check ((induk_id is null) = (kemasan is null) and (kemasan is null or length(trim(kemasan)) between 1 and 40));
create index menu_induk_id on public.menu(induk_id);
create unique index menu_kemasan_unik on public.menu(induk_id, lower(kemasan)) where deleted_at is null and induk_id is not null;

create schema menu_internal;
revoke all on schema menu_internal from public, anon;
grant usage on schema menu_internal to authenticated;

create function menu_internal.atur_varian(p jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare m menu; x jsonb; cid uuid; ids uuid[]:='{}'; baru uuid[]:='{}'; anak uuid; lama jsonb;
begin
 if auth.uid() is null or not punya_peran('{owner,admin_pusat,admin_gudang}') then raise exception 'Hanya Owner/Admin Pusat/Admin Gudang yang dapat mengatur varian menu';end if;
 if octet_length(p::text)>200000 then raise exception 'Data terlalu besar';end if;
 select * into m from menu where id=(p->>'menu_id')::uuid and mode='asli' and deleted_at is null for update;
 if m.id is null or m.induk_id is not null then raise exception 'Menu induk tidak ditemukan';end if;
 if jsonb_typeof(p->'kemasan') is distinct from 'array' or jsonb_typeof(p->'opsi') is distinct from 'array' then raise exception 'Format varian tidak valid';end if;
 if jsonb_array_length(p->'kemasan')>12 or jsonb_array_length(p->'opsi')>60 then raise exception 'Pilihan terlalu banyak';end if;
 if exists(select 1 from jsonb_array_elements(p->'kemasan') z where jsonb_typeof(z)<>'object'
   or length(trim(coalesce(z->>'nama',''))) not between 1 and 40
   or coalesce(z->>'harga_langsung','') !~ '^[0-9]{1,9}$' or coalesce(z->>'harga_ojol','') !~ '^[0-9]{1,9}$'
   or (nullif(z->>'id','') is not null and z->>'id' !~ '^[0-9a-f-]{36}$')) then
  raise exception 'Nama kemasan 1-40 karakter dan harga berupa rupiah bulat 0 atau lebih';end if;
 if exists(select 1 from jsonb_array_elements(p->'kemasan') z group by lower(trim(z->>'nama')) having count(*)>1) then raise exception 'Nama kemasan tidak boleh sama';end if;
 if exists(select 1 from jsonb_array_elements(p->'opsi') z where jsonb_typeof(z)<>'object'
   or coalesce(z->>'grup','') not in ('Gula','Suhu','Ukuran','Extra')
   or length(trim(coalesce(z->>'nama',''))) not between 1 and 40
   or coalesce(z->>'tambahan_harga','0') !~ '^[0-9]{1,9}$') then
  raise exception 'Pilihan wajib punya grup, nama 1-40 karakter, dan harga tambahan rupiah 0 atau lebih';end if;
 if exists(select 1 from jsonb_array_elements(p->'opsi') z group by z->>'grup', lower(trim(z->>'nama')) having count(*)>1) then raise exception 'Pilihan dalam satu grup tidak boleh sama';end if;
 select jsonb_build_object('kemasan',coalesce(jsonb_agg(jsonb_build_object('id',id,'kemasan',kemasan,'langsung',harga_langsung,'ojol',harga_ojol,'aktif',aktif)),'[]')) into lama from menu where induk_id=m.id and deleted_at is null;

 for x in select * from jsonb_array_elements(p->'kemasan') loop
  cid:=nullif(x->>'id','')::uuid;
  if cid is not null then
   update menu set kemasan=trim(x->>'nama'),nama=m.nama||' ('||trim(x->>'nama')||')',harga_langsung=(x->>'harga_langsung')::bigint,
     harga_ojol=(x->>'harga_ojol')::bigint,aktif=coalesce((x->>'aktif')::boolean,true),kategori_id=m.kategori_id,foto_url=m.foto_url
   where id=cid and induk_id=m.id and deleted_at is null;
   if not found then raise exception 'Kemasan sudah berubah. Muat ulang halaman dahulu';end if;
  else
   insert into menu(mode,kategori_id,nama,harga_langsung,harga_ojol,aktif,foto_url,urutan,induk_id,kemasan)
   values('asli',m.kategori_id,m.nama||' ('||trim(x->>'nama')||')',(x->>'harga_langsung')::bigint,(x->>'harga_ojol')::bigint,
     coalesce((x->>'aktif')::boolean,true),m.foto_url,m.urutan,m.id,trim(x->>'nama')) returning id into cid;
   baru:=baru||cid;
  end if;
  ids:=ids||cid;
 end loop;
 update menu set deleted_at=now(),aktif=false where induk_id=m.id and deleted_at is null and not (id=any(ids));
 update varian set deleted_at=now() where deleted_at is null and menu_id in (select id from menu where induk_id=m.id and deleted_at is not null);

 -- Gula/Extra/dll: id varian tetap stabil (dicocokkan per grup+nama) agar resep per varian tidak putus.
 for anak in select m.id union all select id from menu where induk_id=m.id and deleted_at is null loop
  update varian v set deleted_at=now() where v.menu_id=anak and v.deleted_at is null
   and not exists(select 1 from jsonb_array_elements(p->'opsi') z where z->>'grup'=v.grup and lower(trim(z->>'nama'))=lower(v.nama));
  for x in select * from jsonb_array_elements(p->'opsi') loop
   update varian set nama=trim(x->>'nama'),tambahan_harga=coalesce((x->>'tambahan_harga')::bigint,0)
   where menu_id=anak and deleted_at is null and grup=x->>'grup' and lower(nama)=lower(trim(x->>'nama'));
   if not found then insert into varian(mode,menu_id,grup,nama,tambahan_harga) values('asli',anak,x->>'grup',trim(x->>'nama'),coalesce((x->>'tambahan_harga')::bigint,0));end if;
  end loop;
 end loop;

 -- Kemasan baru menyalin resep menu induk (termasuk resep per varian) sebagai titik awal.
 insert into resep(mode,menu_id,varian_id,bahan_id,takaran)
 select 'asli',b.id,va.id,r.bahan_id,r.takaran
 from unnest(baru) b(id)
 join resep r on r.menu_id=m.id and r.mode='asli' and r.deleted_at is null
 left join varian vi on vi.id=r.varian_id
 left join varian va on va.menu_id=b.id and va.deleted_at is null and va.grup=vi.grup and lower(va.nama)=lower(vi.nama)
 where r.varian_id is null or va.id is not null;

 insert into log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_lama,nilai_baru) values(auth.uid(),'varian_menu','menu',m.id::text,lama,p);
 return jsonb_build_object('kemasan',to_jsonb(ids),'baru',to_jsonb(baru));
end $$;
revoke all on function menu_internal.atur_varian(jsonb) from public,anon;
grant execute on function menu_internal.atur_varian(jsonb) to authenticated;
create function public.atur_varian_menu(p jsonb) returns jsonb language sql security invoker set search_path='' as $$ select menu_internal.atur_varian(p) $$;
revoke all on function public.atur_varian_menu(jsonb) from public,anon;
grant execute on function public.atur_varian_menu(jsonb) to authenticated;

-- Ubah nama/kategori/foto/urutan/hapus menu induk ikut ke kemasannya.
create function menu_internal.sinkron_kemasan() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.induk_id is not null then return new;end if;
 if (new.nama,new.kategori_id,new.foto_url,new.urutan) is distinct from (old.nama,old.kategori_id,old.foto_url,old.urutan) then
  update menu set nama=new.nama||' ('||kemasan||')',kategori_id=new.kategori_id,foto_url=new.foto_url,urutan=new.urutan
  where induk_id=new.id and deleted_at is null;
 end if;
 if new.deleted_at is not null and old.deleted_at is null then
  update menu set deleted_at=new.deleted_at where induk_id=new.id and deleted_at is null;
 elsif new.deleted_at is null and old.deleted_at is not null then
  update menu set deleted_at=null where induk_id=new.id and deleted_at=old.deleted_at;
 end if;
 return new;
end $$;
revoke all on function menu_internal.sinkron_kemasan() from public,anon,authenticated;
create trigger sinkron_kemasan after update on public.menu for each row execute function menu_internal.sinkron_kemasan();
