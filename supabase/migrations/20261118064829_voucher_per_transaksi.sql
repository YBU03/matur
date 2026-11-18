-- Explicit scope distinguishes fixed transaction vouchers from item discounts/final prices.
alter table promo_internal.promo
 add column cakupan text not null default 'item' check(cakupan in ('item','transaksi')),
 add column nilai_voucher bigint check(nilai_voucher>0),
 add column minimum_belanja bigint not null default 0 check(minimum_belanja>=0),
 add constraint promo_voucher_nilai check(cakupan<>'transaksi' or nilai_voucher is not null);
do $patch$
declare f text;old text;new text;
begin
 f:=pg_get_functiondef('promo_internal.simpan(jsonb)'::regprocedure);
 old:='insert into public.log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_lama,nilai_baru)';
 new:=$code$update promo_internal.promo set cakupan=coalesce(p->>'cakupan','item'),nilai_voucher=case when p->>'cakupan'='transaksi' then (p->>'nilai_voucher')::bigint end,minimum_belanja=coalesce((p->>'minimum_belanja')::bigint,0),per_menu=case when p->>'cakupan'='transaksi' then false else coalesce((p->>'per_menu')::boolean,false) end where id=x.id;
 -- A scope change must not leave old doubled reservations redeemable.
 if coalesce(x.cakupan,'item')<>coalesce(p->>'cakupan','item') then
  update promo_internal.pesanan set status='lepas' where promo_id=x.id and status='pesan';
 end if;
 insert into public.log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_lama,nilai_baru)$code$;
 if strpos(f,old)=0 then raise exception 'Voucher: save anchor changed';end if;execute replace(f,old,new);
 f:=pg_get_functiondef('promo_internal.pesan(jsonb)'::regprocedure);
 old:='unit_diskon bigint;';new:='unit_diskon bigint; eligible bigint:=0;';
 if strpos(f,old)=0 then raise exception 'Voucher: declaration anchor changed';end if;f:=replace(f,old,new);
 old:='  if a is not null then';new:=$code$  if a is not null then
   eligible:=eligible+harga*(it->>'qty')::integer;$code$;
 if strpos(f,old)=0 then raise exception 'Voucher: eligibility anchor changed';end if;f:=replace(f,old,new);
 old:=' if pot<=0 then';new:=$code$ if eligible<x.minimum_belanja then raise exception 'Minimum belanja menu terpilih Rp% (sebelum potongan)',x.minimum_belanja;end if;
 if x.cakupan='transaksi' then
  -- Eligibility only: never multiply this amount by line count or quantity.
  pot:=least(x.nilai_voucher,eligible);
  rin:=case when pot>0 then jsonb_build_object('voucher',1) else '{}'::jsonb end;
 end if;
 if pot<=0 then$code$;
 if strpos(f,old)=0 then raise exception 'Voucher: discount anchor changed';end if;f:=replace(f,old,new);
 f:=replace(f,$s$'nama_subsidi',x.nama_subsidi)$s$,$s$'nama_subsidi',x.nama_subsidi,'cakupan',x.cakupan,'nilai_voucher',x.nilai_voucher,'minimum_belanja',x.minimum_belanja)$s$);
 f:=replace(f,$s$'nama_subsidi',r.snapshot->>'nama_subsidi')$s$,$s$'nama_subsidi',r.snapshot->>'nama_subsidi','cakupan',coalesce(r.snapshot->>'cakupan','item'),'nilai_voucher',r.snapshot->'nilai_voucher','minimum_belanja',r.snapshot->'minimum_belanja')$s$);
 execute f;
 f:=pg_get_functiondef('promo_internal.laporan(uuid,date,date)'::regprocedure);
 old:=$s$'promo',r.snapshot->>'nama'$s$;new:=$s$'promo',r.snapshot->>'nama','cakupan',coalesce(r.snapshot->>'cakupan','item')$s$;
 if strpos(f,old)=0 then raise exception 'Voucher: report anchor changed';end if;execute replace(f,old,new);
end $patch$;
-- Accounting labels frozen scope without changing any totals or posting another expense.
do $patch$
declare f text;old text;new text;
begin
 f:=pg_get_functiondef('promo_internal.marketing(uuid,date,date)'::regprocedure);
 old:=$s$'nama',coalesce(t.promo_snapshot->>'nama','Diskon manual')$s$;
 new:=$s$'nama',coalesce(t.promo_snapshot->>'nama','Diskon manual'),'cakupan',coalesce(t.promo_snapshot->>'cakupan','item')$s$;
 if strpos(f,old)=0 then raise exception 'Voucher: marketing anchor changed';end if;execute replace(f,old,new);
end $patch$;
