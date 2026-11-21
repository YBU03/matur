-- Evaluate the session identity once per statement; row-dependent outlet gates stay explicit.
alter policy hanya_petugas on stok_outlet_internal.perintah using(pengguna=(select auth.uid()));
alter policy baca on public.setelan_stok_outlet using(stok_outlet_internal.lihat(outlet_id) or
 ((select auth.uid()) is not null and exists(select 1 from public.pengguna where id=(select auth.uid()) and status='aktif')
 and public.peran_di_outlet(outlet_id,'{kasir,barista,tablet}')));
-- Keep the privileged destination lookup private, exposing only the checked invoker wrapper.
do $$declare f text;begin
 f:=pg_get_functiondef('public.tujuan_stok_outlet()'::regprocedure);
 f:=replace(f,'FUNCTION public.tujuan_stok_outlet()', 'FUNCTION stok_outlet_internal.tujuan()');
 execute f;
end $$;
revoke all on function stok_outlet_internal.tujuan() from public,anon,authenticated;
grant execute on function stok_outlet_internal.tujuan() to authenticated;
create or replace function public.tujuan_stok_outlet() returns jsonb language sql stable security invoker set search_path='' as $$select stok_outlet_internal.tujuan()$$;
revoke all on function public.tujuan_stok_outlet() from public,anon;
grant execute on function public.tujuan_stok_outlet() to authenticated;
