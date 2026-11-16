-- Cadangan hitungan saja; tidak memiliki trigger/mutasi stok.
create table public.draft_opname_outlet (
 id uuid primary key,
 pengguna_id uuid not null default auth.uid() references public.pengguna(id),
 outlet_id uuid not null references public.outlet(id),
 tanggal date not null,
 scope text not null check(length(scope) between 1 and 180),
 versi bigint not null check(versi>0),
 data jsonb not null check(jsonb_typeof(data)='object' and octet_length(data::text)<=500000),
 updated_at timestamptz not null default clock_timestamp()
);
create index draft_opname_pemilik on public.draft_opname_outlet(pengguna_id,outlet_id,updated_at desc);
alter table public.draft_opname_outlet enable row level security;
revoke all on public.draft_opname_outlet from anon,authenticated;
grant select,insert,update on public.draft_opname_outlet to authenticated;
create policy draft_so_baca on public.draft_opname_outlet for select to authenticated using (
 pengguna_id=(select auth.uid()) and (public.gudang_pusat() or public.punya_peran('{hrd,finance}') or public.peran_di_outlet(outlet_id,'{kasir,barista,spv}'))
);
create policy draft_so_tambah on public.draft_opname_outlet for insert to authenticated with check (
 pengguna_id=(select auth.uid()) and (public.gudang_pusat() or public.punya_peran('{hrd,finance}') or public.peran_di_outlet(outlet_id,'{kasir,barista,spv}'))
);
create policy draft_so_ubah on public.draft_opname_outlet for update to authenticated using (
 pengguna_id=(select auth.uid()) and (public.gudang_pusat() or public.punya_peran('{hrd,finance}') or public.peran_di_outlet(outlet_id,'{kasir,barista,spv}'))
) with check (
 pengguna_id=(select auth.uid()) and (public.gudang_pusat() or public.punya_peran('{hrd,finance}') or public.peran_di_outlet(outlet_id,'{kasir,barista,spv}'))
);
create function public.cadangkan_draft_so(p jsonb) returns void
language sql security invoker set search_path='' as $$
 insert into public.draft_opname_outlet(id,outlet_id,tanggal,scope,versi,data)
 values((p->>'id')::uuid,(p->>'outletId')::uuid,(p->>'tanggal')::date,p->>'scope',(p->>'updatedAt')::bigint,p)
 on conflict(id) do update set data=excluded.data,versi=excluded.versi,updated_at=clock_timestamp()
 where draft_opname_outlet.versi<excluded.versi
 and draft_opname_outlet.pengguna_id=(select auth.uid())
 and draft_opname_outlet.outlet_id=excluded.outlet_id
 and draft_opname_outlet.tanggal=excluded.tanggal
 and draft_opname_outlet.scope=excluded.scope;
$$;
revoke all on function public.cadangkan_draft_so(jsonb) from public,anon;
grant execute on function public.cadangkan_draft_so(jsonb) to authenticated;
