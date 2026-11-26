-- Product category, serving temperature and package are independent metadata.
-- Existing kemasan/induk_id remain the priced child-menu graph; never repurpose them.
alter table public.menu
 add column penyajian text check (penyajian in ('ice','hot','tanpa')),
 add column jenis_kemasan text check (jenis_kemasan is null or length(trim(jenis_kemasan)) between 1 and 40);

-- A new priced child inherits serving; explicit Ice/Hot packaging can override it.
create function menu_internal.metadata_kemasan() returns trigger
language plpgsql security invoker set search_path='' as $$
declare p public.menu;
begin
 if new.induk_id is null then return new;end if;
 select * into p from public.menu where id=new.induk_id;
 new.penyajian:=coalesce(new.penyajian,case lower(trim(new.kemasan)) when 'ice' then 'ice' when 'hot' then 'hot' else p.penyajian end);
 new.jenis_kemasan:=coalesce(new.jenis_kemasan,case lower(trim(new.kemasan)) when 'ice' then 'Cup' when 'hot' then 'Cup' else new.kemasan end,p.jenis_kemasan);
 return new;
end $$;
revoke all on function menu_internal.metadata_kemasan() from public,anon,authenticated;
create trigger metadata_kemasan before insert on public.menu for each row execute function menu_internal.metadata_kemasan();

-- Only the narrow Marketing projection gains these non-financial fields.
do $patch$
declare f text;
begin
 f:=pg_get_functiondef('marketing_internal.katalog_promo_marketing()'::regprocedure);
 if position('''kategori_id'',kategori_id' in f)=0 then raise exception 'Katalog Marketing berubah';end if;
 execute replace(f,'''kategori_id'',kategori_id','''kategori_id'',kategori_id,''penyajian'',penyajian,''jenis_kemasan'',jenis_kemasan');
 f:=pg_get_functiondef('usaha_internal.salin(jsonb)'::regprocedure);
 if position('kemasan,outlet_id)' in f)=0 or position('m.kemasan,o);' in f)=0 then raise exception 'Salinan katalog berubah';end if;
 f:=replace(f,'kemasan,outlet_id)','kemasan,outlet_id,penyajian,jenis_kemasan)');
 f:=replace(f,'m.kemasan,o);','m.kemasan,o,m.penyajian,m.jenis_kemasan);');
 execute f;
end $patch$;
