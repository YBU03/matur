-- Editor resep dari HPP Menu / Varian & Kemasan: ganti resep dasar (varian_id null) satu menu sekaligus.
-- Resep per varian dan snapshot file HPP (hpp_menu) tidak disentuh.
create function menu_internal.atur_resep(p jsonb) returns integer
language plpgsql security definer set search_path=public,pg_temp as $$
declare m menu; x jsonb; n integer:=0; lama jsonb;
begin
 if auth.uid() is null or not punya_peran('{owner,admin_pusat,admin_gudang}') then raise exception 'Hanya Owner/Admin Pusat/Admin Gudang yang dapat mengatur resep';end if;
 if octet_length(p::text)>100000 then raise exception 'Data terlalu besar';end if;
 select * into m from menu where id=(p->>'menu_id')::uuid and mode='asli' and deleted_at is null for update;
 if m.id is null then raise exception 'Menu tidak ditemukan';end if;
 if coalesce(m.titipan,false) then raise exception 'Produk titipan memakai harga titip, bukan resep';end if;
 if jsonb_typeof(p->'bahan') is distinct from 'array' or jsonb_array_length(p->'bahan')>100 then raise exception 'Isi 0-100 bahan';end if;
 if exists(select 1 from jsonb_array_elements(p->'bahan') z where jsonb_typeof(z)<>'object'
   or coalesce(z->>'bahan_id','') !~ '^[0-9a-f-]{36}$'
   or coalesce(z->>'takaran','') !~ '^[0-9]{1,7}(\.[0-9]{1,3})?$' or (z->>'takaran')::numeric<=0 or (z->>'takaran')::numeric>1000000) then
  raise exception 'Takaran wajib angka lebih dari 0 (maks. 3 desimal)';end if;
 if exists(select 1 from jsonb_array_elements(p->'bahan') z group by z->>'bahan_id' having count(*)>1) then raise exception 'Bahan tidak boleh berulang';end if;
 if exists(select 1 from jsonb_array_elements(p->'bahan') z where not exists(select 1 from bahan b where b.id=(z->>'bahan_id')::uuid and b.mode='asli' and b.deleted_at is null)) then raise exception 'Bahan tidak ditemukan';end if;
 select coalesce(jsonb_agg(jsonb_build_object('bahan_id',bahan_id,'takaran',takaran)),'[]') into lama from resep where menu_id=m.id and varian_id is null and mode='asli' and deleted_at is null;
 update resep set deleted_at=now() where menu_id=m.id and varian_id is null and mode='asli' and deleted_at is null;
 for x in select * from jsonb_array_elements(p->'bahan') loop
  insert into resep(mode,menu_id,varian_id,bahan_id,takaran) values('asli',m.id,null,(x->>'bahan_id')::uuid,(x->>'takaran')::numeric);
  n:=n+1;
 end loop;
 insert into log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_lama,nilai_baru) values(auth.uid(),'resep_menu','menu',m.id::text,lama,p->'bahan');
 return n;
end $$;
revoke all on function menu_internal.atur_resep(jsonb) from public,anon;
grant execute on function menu_internal.atur_resep(jsonb) to authenticated;
create function public.atur_resep_menu(p jsonb) returns integer language sql security invoker set search_path='' as $$ select menu_internal.atur_resep(p) $$;
revoke all on function public.atur_resep_menu(jsonb) from public,anon;
grant execute on function public.atur_resep_menu(jsonb) to authenticated;
