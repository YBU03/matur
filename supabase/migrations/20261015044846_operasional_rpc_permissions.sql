-- Legacy callers must authenticate before recording stock or receiving shipments.
revoke all on function public.terima_kiriman(uuid,jsonb,text) from public,anon;
revoke all on function public.simpan_opname(uuid,date,jsonb,text) from public,anon;
grant execute on function public.terima_kiriman(uuid,jsonb,text), public.simpan_opname(uuid,date,jsonb,text) to authenticated;
