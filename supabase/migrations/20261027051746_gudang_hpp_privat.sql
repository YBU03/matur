-- Snapshot biaya hanya boleh dibaca melalui laporan gudang yang berizin.
create table gudang_internal.hpp_kiriman(
 item_id uuid primary key references public.item_kiriman(id) on delete cascade,
 hpp numeric check(hpp>=0)
);
alter table gudang_internal.hpp_kiriman enable row level security;
revoke all on gudang_internal.hpp_kiriman from public,anon,authenticated;
create policy snapshot_privat on gudang_internal.hpp_kiriman to authenticated using(false) with check(false);
insert into gudang_internal.hpp_kiriman(item_id,hpp)
 select id,hpp_gudang from public.item_kiriman where hpp_gudang is not null;
do $patch$
declare s text;
begin
 s:=pg_get_functiondef('gudang_internal.kirim(uuid)'::regprocedure);
 if position('update public.item_kiriman set hpp_gudang=h*i.konversi where id=i.id;' in s)=0 then raise exception 'Definisi kirim berubah';end if;
 s:=replace(s,'update public.item_kiriman set hpp_gudang=h*i.konversi where id=i.id;',
 'insert into gudang_internal.hpp_kiriman(item_id,hpp) values(i.id,h*i.konversi) on conflict(item_id) do update set hpp=excluded.hpp;');
 execute s;
 s:=pg_get_functiondef('gudang_internal.laporan(date,date,uuid,uuid)'::regprocedure);
 if position('i.hpp_gudang' in s)=0 then raise exception 'Definisi laporan berubah';end if;
 s:=replace(s,'i.hpp_gudang','c.hpp as hpp_gudang');
 s:=replace(s,'where k.mode=','left join gudang_internal.hpp_kiriman c on c.item_id=i.id where k.mode=');
 execute s;
end $patch$;
alter table public.item_kiriman drop column hpp_gudang;
