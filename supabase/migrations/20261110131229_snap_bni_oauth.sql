-- Client Secret OAuth BNI Direct API (sandbox) di Vault + info untuk panel admin.
create table if not exists snap_sandbox_internal.bni_oauth (
 id boolean primary key default true check (id),
 client_id text not null,
 secret_id uuid not null references vault.secrets(id),
 diubah_at timestamptz not null default now(),
 diubah_oleh uuid
);
alter table snap_sandbox_internal.bni_oauth enable row level security;
revoke all on snap_sandbox_internal.bni_oauth from public, anon, authenticated;

create or replace function public.snap_bni_oauth_service(p_action text, p_data jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare o snap_sandbox_internal.bni_oauth; sid uuid; s text;
begin
 if coalesce(auth.role(), '') <> 'service_role' then raise exception 'Server only'; end if;
 if p_action = 'simpan' then
  if coalesce(p_data->>'client_id', '') !~ '^[A-Za-z0-9._-]{3,100}$' then raise exception 'Client ID tidak valid'; end if;
  if coalesce(length(p_data->>'secret'), 0) < 8 or length(p_data->>'secret') > 500 then raise exception 'Client Secret tidak valid'; end if;
  perform pg_advisory_xact_lock(hashtext('matoer-bni-oauth'));
  select * into o from snap_sandbox_internal.bni_oauth where id for update;
  if o.id is null then
   select vault.create_secret(p_data->>'secret', 'matoer-bni-oauth-secret-' || gen_random_uuid()::text, 'Client Secret OAuth BNI Direct API (sandbox)') into sid;
  else
   sid := o.secret_id;
   perform vault.update_secret(sid, p_data->>'secret');
  end if;
  insert into snap_sandbox_internal.bni_oauth(id, client_id, secret_id, diubah_at, diubah_oleh)
  values (true, p_data->>'client_id', sid, now(), nullif(p_data->>'oleh', '')::uuid)
  on conflict (id) do update set client_id = excluded.client_id, diubah_at = now(), diubah_oleh = excluded.diubah_oleh;
  insert into public.log_aktivitas(pengguna_id, aksi, entitas, entitas_id, nilai_baru)
  values (nullif(p_data->>'oleh', '')::uuid, 'simpan_oauth_bni', 'snap_sandbox', 'bni_oauth', jsonb_build_object('client_id', p_data->>'client_id'));
  return jsonb_build_object('ok', true);
 elsif p_action = 'ambil' then
  select * into o from snap_sandbox_internal.bni_oauth where id;
  if o.id is null then raise exception 'Client Secret BNI belum disimpan'; end if;
  select decrypted_secret into s from vault.decrypted_secrets where id = o.secret_id;
  return jsonb_build_object('client_id', o.client_id, 'secret', s);
 end if;
 raise exception 'Aksi tidak dikenal';
end $$;
revoke all on function public.snap_bni_oauth_service(text, jsonb) from public, anon, authenticated;
grant execute on function public.snap_bni_oauth_service(text, jsonb) to service_role;

create or replace function public.snap_bni_kunci_info() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare k snap_sandbox_internal.bni_kunci; o snap_sandbox_internal.bni_oauth;
begin
 if not snap_sandbox_internal.boleh_admin() then raise exception 'Hanya Owner, Admin Pusat atau Finance aktif'; end if;
 select * into k from snap_sandbox_internal.bni_kunci where id;
 select * into o from snap_sandbox_internal.bni_oauth where id;
 return jsonb_build_object('ada', k.id is not null, 'sertifikat', k.sertifikat, 'public_pem', k.public_pem, 'dibuat_at', k.dibuat_at,
  'oauth', jsonb_build_object('ada', o.id is not null, 'client_id', o.client_id, 'diubah_at', o.diubah_at));
end $$;
