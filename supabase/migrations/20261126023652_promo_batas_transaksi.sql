-- Optional constraints; old promotions keep their existing behaviour.
alter table promo_internal.promo
 add column batas_diskon bigint check (batas_diskon>0),
 add column dasar_minimum text not null default 'menu' check (dasar_minimum in ('menu','keranjang')),
 add column kanal_ids text[] not null default '{}' check (kanal_ids <@ array['langsung','ruma_app','gofood','grabfood','shopeefood','tiktok','tumbler']::text[]);

do $patch$
declare f text; old text;
begin
 f:=pg_get_functiondef('promo_internal.simpan(jsonb)'::regprocedure);
 old:=' insert into public.log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_lama,nilai_baru)';
 if position(old in f)=0 then raise exception 'Promo save audit anchor changed';end if;
 f:=replace(f,old,$code$
 update promo_internal.promo set
  batas_diskon=case when p ? 'batas_diskon' then nullif(p->>'batas_diskon','')::bigint else batas_diskon end,
  dasar_minimum=case when p ? 'dasar_minimum' then p->>'dasar_minimum' else dasar_minimum end,
  kanal_ids=case when p ? 'kanal_ids' then coalesce((select array_agg(distinct v) from jsonb_array_elements_text(p->'kanal_ids') v),'{}') else kanal_ids end
 where id=x.id;
 -- Never allow a previously issued uncapped/other-channel quote to bypass new constraints.
 if exists(select 1 from promo_internal.promo r where r.id=x.id and (r.batas_diskon,r.dasar_minimum,r.kanal_ids) is distinct from (x.batas_diskon,coalesce(x.dasar_minimum,'menu'),coalesce(x.kanal_ids,'{}'))) then
  update promo_internal.pesanan set status='lepas' where promo_id=x.id and status='pesan';
 end if;
 insert into public.log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_lama,nilai_baru)$code$);
 execute f;
 f:=pg_get_functiondef('promo_internal.pesan(jsonb)'::regprocedure);
 if position('pot bigint:=0;' in f)=0 then raise exception 'Promo calculation declaration changed';end if;
 f:=replace(f,'pot bigint:=0;','pot bigint:=0; pot_awal bigint:=0;');
 old:=' if not x.boleh_manual';
 if position(old in f)=0 then raise exception 'Promo channel anchor changed';end if;
 f:=replace(f,old,$code$ if cardinality(x.kanal_ids)>0 and not (coalesce(p->>'kanal','')=any(x.kanal_ids)) then raise exception 'Promo tidak berlaku untuk kanal ini';end if;
 if not x.boleh_manual$code$);
 old:=$code$ if eligible<x.minimum_belanja then raise exception 'Minimum belanja menu terpilih Rp% (sebelum potongan)',x.minimum_belanja;end if;$code$;
 if position(old in f)=0 then raise exception 'Promo minimum anchor changed';end if;
 f:=replace(f,old,$code$ if x.dasar_minimum='keranjang' then
  if sub<x.minimum_belanja then raise exception 'Minimum total belanja Rp% (sebelum potongan)',x.minimum_belanja;end if;
 elsif eligible<x.minimum_belanja then raise exception 'Minimum belanja menu terpilih Rp% (sebelum potongan)',x.minimum_belanja;end if;$code$);
 old:=' if pot<=0 and lebih';
 if position(old in f)=0 then raise exception 'Promo cap anchor changed';end if;
 f:=replace(f,old,$code$ pot_awal:=pot;
 if x.batas_diskon is not null then pot:=least(pot,x.batas_diskon);end if;
 if pot<=0 and lebih$code$);
 -- Freeze constraints and pre-cap value alongside the authoritative total for receipts/audit.
 f:=replace(f,'''minimum_belanja'',x.minimum_belanja', '''minimum_belanja'',x.minimum_belanja,''batas_diskon'',x.batas_diskon,''dasar_minimum'',x.dasar_minimum,''kanal_ids'',x.kanal_ids,''diskon_sebelum_batas'',pot_awal');
 f:=replace(f,'''minimum_belanja'',r.snapshot->''minimum_belanja''', '''minimum_belanja'',r.snapshot->''minimum_belanja'',''batas_diskon'',r.snapshot->''batas_diskon'',''dasar_minimum'',r.snapshot->''dasar_minimum'',''kanal_ids'',r.snapshot->''kanal_ids'',''diskon_sebelum_batas'',r.snapshot->''diskon_sebelum_batas''');
 execute f;
 f:=pg_get_functiondef('promo_internal.mitra(uuid,date,date)'::regprocedure);
 old:='''minimum_belanja'', r.minimum_belanja';
 if position(old in f)=0 then raise exception 'Mitra promo projection changed';end if;
 execute replace(f,old,'''minimum_belanja'', r.minimum_belanja, ''batas_diskon'', r.batas_diskon, ''dasar_minimum'', r.dasar_minimum, ''kanal_ids'', r.kanal_ids');
end $patch$;
