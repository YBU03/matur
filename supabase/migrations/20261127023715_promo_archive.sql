-- Soft deletion keeps sale snapshots, quota history and accounting records intact.
alter table promo_internal.promo
 add column diarsipkan_at timestamptz,
 add column diarsipkan_oleh uuid,
 add column diarsipkan_nama text,
 add constraint promo_arsip_nonaktif check (diarsipkan_at is null or not aktif);

create function promo_internal.arsip(i uuid, v integer, pulihkan boolean default false)
returns uuid language plpgsql security definer set search_path='' as $$
declare x promo_internal.promo; lama jsonb;
begin
 if auth.uid() is null then raise exception 'Masuk terlebih dahulu'; end if;
 select * into x from promo_internal.promo where id=i for update;
 if x.id is null then raise exception 'Promo tidak ditemukan'; end if;
 if not promo_internal.pusat() and (x.semua_outlet or cardinality(x.outlet_ids)<>1 or not promo_internal.kelola(x.outlet_ids[1])) then
  raise exception 'Tidak berwenang mengubah promo ini';
 end if;
 if x.versi is distinct from v then raise exception 'Promo diubah pengguna lain. Muat ulang'; end if;
 if pulihkan is null then raise exception 'Tindakan tidak valid'; end if;
 if pulihkan and x.diarsipkan_at is null then raise exception 'Promo tidak berada di arsip'; end if;
 if not pulihkan and x.diarsipkan_at is not null then raise exception 'Promo sudah diarsipkan'; end if;
 lama:=to_jsonb(x);
 update promo_internal.promo set aktif=false,
  diarsipkan_at=case when pulihkan then null else clock_timestamp() end,
  diarsipkan_oleh=case when pulihkan then null else auth.uid() end,
  diarsipkan_nama=case when pulihkan then null else (select nama from public.pengguna where id=auth.uid()) end,
  versi=versi+1,diubah_at=clock_timestamp(),diubah_oleh=auth.uid()
 where id=i;
 -- Same promo-row lock as quote/checkout: no quote can be redeemed after archive wins.
 -- Completed sales (pakai/void) and snapshots are never changed.
 update promo_internal.pesanan set status='lepas' where promo_id=i and status='pesan';
 insert into public.log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_lama,nilai_baru)
 select auth.uid(),case when pulihkan then 'pulihkan_promo' else 'arsip_promo' end,'promo',i::text,lama,to_jsonb(r)
 from promo_internal.promo r where r.id=i;
 return i;
end $$;
create function public.arsip_promo(i uuid,v integer,pulihkan boolean default false)
returns uuid language sql security invoker set search_path='' as $$select promo_internal.arsip(i,v,pulihkan)$$;
revoke all on function promo_internal.arsip(uuid,integer,boolean),public.arsip_promo(uuid,integer,boolean) from public,anon;
grant execute on function promo_internal.arsip(uuid,integer,boolean),public.arsip_promo(uuid,integer,boolean) to authenticated;

do $patch$
declare f text; old text;
begin
 f:=pg_get_functiondef('promo_internal.simpan(jsonb)'::regprocedure);
 old:='  if x.versi is distinct from (p->>''versi'')::integer';
 if position(old in f)=0 then raise exception 'Promo save version anchor changed'; end if;
 execute replace(f,old,$code$  if x.diarsipkan_at is not null then raise exception 'Promo diarsipkan. Pulihkan dahulu sebelum mengedit'; end if;
  if x.versi is distinct from (p->>'versi')::integer$code$);
 f:=pg_get_functiondef('promo_internal.daftar(uuid,boolean)'::regprocedure);
 old:=' where (case when manajemen then';
 if position(old in f)=0 then raise exception 'Promo list scope anchor changed'; end if;
 execute replace(f,old,' where (manajemen or r.diarsipkan_at is null) and (case when manajemen then');
 f:=pg_get_functiondef('promo_internal.pesan(jsonb)'::regprocedure);
 old:='if x.id is null or not x.aktif';
 if position(old in f)=0 then raise exception 'Promo quote availability anchor changed'; end if;
 execute replace(f,old,'if x.id is null or x.diarsipkan_at is not null or not x.aktif');
 f:=pg_get_functiondef('promo_internal.ambil(jsonb)'::regprocedure);
 old:=' perform 1 from promo_internal.promo where id=r.promo_id for update;';
 if position(old in f)=0 then raise exception 'Promo checkout lock anchor changed'; end if;
 execute replace(f,old,$code$ perform 1 from promo_internal.promo where id=r.promo_id and diarsipkan_at is null for update;
 if not found then raise exception 'Reservasi promo dibatalkan karena promo diarsipkan. Pilih promo kembali atau gunakan harga normal'; end if;$code$);
end $patch$;
