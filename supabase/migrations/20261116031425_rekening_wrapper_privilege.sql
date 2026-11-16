-- authenticated has no USAGE on matur_internal. Keep it private: the fixed,
-- no-search-path wrapper can call only the narrow guarded self-service function.
create or replace function public.simpan_rekening_sendiri(p_bank text,p_nomor text,p_nama text) returns void
language sql security definer set search_path='' as $$select matur_internal.simpan_rekening_sendiri(p_bank,p_nomor,p_nama)$$;
revoke all on function public.simpan_rekening_sendiri(text,text,text) from public,anon;
grant execute on function public.simpan_rekening_sendiri(text,text,text) to authenticated;
