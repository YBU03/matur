-- Keep privilege-bearing implementations out of the exposed public schema.
-- Authenticated callers use invoker wrappers; each private implementation
-- still checks active account and Marketing/Owner/Admin assignment.
alter function public.katalog_promo_marketing() set schema marketing_internal;
alter function public.jadwal_marketing_hari_ini() set schema marketing_internal;
create function public.katalog_promo_marketing() returns jsonb language sql security invoker set search_path='' as $$
 select marketing_internal.katalog_promo_marketing();
$$;
create function public.jadwal_marketing_hari_ini() returns jsonb language sql security invoker set search_path='' as $$
 select marketing_internal.jadwal_marketing_hari_ini();
$$;
revoke all on function public.katalog_promo_marketing(),public.jadwal_marketing_hari_ini() from public,anon;
grant execute on function public.katalog_promo_marketing(),public.jadwal_marketing_hari_ini() to authenticated;
