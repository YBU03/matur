-- Dedicated, non-exposed schema: permit only the self-service capability, without
-- granting USAGE on the existing general-purpose matur_internal schema.
create schema if not exists rekening_internal;
revoke all on schema rekening_internal from public,anon;
grant usage on schema rekening_internal to authenticated;
alter function matur_internal.simpan_rekening_sendiri(text,text,text) set schema rekening_internal;
revoke all on function rekening_internal.simpan_rekening_sendiri(text,text,text) from public,anon;
grant execute on function rekening_internal.simpan_rekening_sendiri(text,text,text) to authenticated;
create or replace function public.simpan_rekening_sendiri(p_bank text,p_nomor text,p_nama text) returns void
language sql security invoker set search_path='' as $$select rekening_internal.simpan_rekening_sendiri(p_bank,p_nomor,p_nama)$$;
revoke all on function public.simpan_rekening_sendiri(text,text,text) from public,anon;
grant execute on function public.simpan_rekening_sendiri(text,text,text) to authenticated;
