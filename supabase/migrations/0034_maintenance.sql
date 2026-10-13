-- Mode maintenance yang bisa dinyalakan owner/admin pusat
alter table perusahaan add column if not exists maintenance boolean not null default false, add column if not exists maintenance_pesan text;
create or replace function public.status_maintenance() returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object('aktif', coalesce(bool_or(maintenance), false), 'pesan', max(maintenance_pesan)) from perusahaan $$;
grant execute on function public.status_maintenance() to anon, authenticated;
create or replace function public.atur_maintenance(p_aktif boolean, p_pesan text) returns void language plpgsql security definer set search_path=public as $$
begin
  if not punya_peran(array['owner','admin_pusat']::peran[]) then raise exception 'Hanya owner/admin pusat'; end if;
  update perusahaan set maintenance = p_aktif, maintenance_pesan = nullif(trim(p_pesan), '') where id is not null;
end $$;
grant execute on function public.atur_maintenance(boolean, text) to authenticated;
