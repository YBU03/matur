-- SNAP BNI outbound sandbox. Gateway inbound, ASPI and POS remain unchanged.
create table snap_sandbox_internal.bni_snap_config (
 id boolean primary key default true check(id),client_id text not null,api_key text not null,
 api_secret_id uuid not null references vault.secrets(id),client_secret_id uuid not null references vault.secrets(id),
 merchant_id text not null default '',terminal_id text not null default '',channel_id text not null default '',
 certificate text not null default '',updated_at timestamptz not null default now()
);
create table snap_sandbox_internal.bni_snap_history (
 id uuid primary key default gen_random_uuid(),created_at timestamptz not null default now(),oleh uuid,
 action text not null check(action in ('token','generate','query')),result jsonb not null check(jsonb_typeof(result)='object')
);
alter table snap_sandbox_internal.bni_snap_config enable row level security;
alter table snap_sandbox_internal.bni_snap_history enable row level security;
revoke all on snap_sandbox_internal.bni_snap_config,snap_sandbox_internal.bni_snap_history from public,anon,authenticated;
create or replace function public.bni_snap_service(p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare c snap_sandbox_internal.bni_snap_config;g bni_internal.konfigurasi;sid uuid;cid uuid;secret text;cs text;prv text;r jsonb;h uuid;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Server only';end if;
 select * into c from snap_sandbox_internal.bni_snap_config where id;
 select * into g from bni_internal.konfigurasi where id;
 if p_action='status' then
  return jsonb_build_object('configured',c.id is not null,'clientId',c.client_id,'apiKeyMasked',case when c.id is not null then '••••'||right(c.api_key,4) else '' end,'merchantId',coalesce(c.merchant_id,''),'terminalId',coalesce(c.terminal_id,''),'channelId',coalesce(c.channel_id,''),'publicKey',g.public_key,'certificate',coalesce(c.certificate,''),'history',coalesce((select jsonb_agg(x order by x.created_at desc) from (select id,created_at,action,result from snap_sandbox_internal.bni_snap_history order by created_at desc limit 50)x),'[]'::jsonb));
 elsif p_action='save' then
  if coalesce(p_data->>'clientId','') !~ '^[A-Za-z0-9._-]{3,100}$' then raise exception 'Client ID invalid';end if;
  if c.id is null or c.client_id<>p_data->>'clientId' then
   if length(coalesce(p_data->>'apiKey',''))<3 or length(coalesce(p_data->>'apiSecret',''))<8 or length(coalesce(p_data->>'clientSecret',''))<8 then raise exception 'Lengkapi ulang kredensial untuk Client ID baru';end if;
  end if;
  if length(coalesce(p_data->>'apiSecret',''))>500 or length(coalesce(p_data->>'clientSecret',''))>500 then raise exception 'Secret too long';end if;
  if coalesce(p_data->>'apiKey','') !~ '^[A-Za-z0-9._-]{0,100}$' or coalesce(p_data->>'merchantId','') !~ '^[A-Za-z0-9._-]{0,100}$' or coalesce(p_data->>'channelId','') !~ '^[A-Za-z0-9._-]{0,100}$' or coalesce(p_data->>'terminalId','') !~ '^[A-Za-z0-9._-]{0,100}$' then raise exception 'Identitas invalid';end if;
  perform pg_advisory_xact_lock(hashtext('bni-snap-sandbox'));
  sid:=c.api_secret_id;cid:=c.client_secret_id;
  if nullif(p_data->>'apiSecret','') is not null then
   if sid is null then select vault.create_secret(p_data->>'apiSecret','bni-snap-api-'||gen_random_uuid()::text) into sid;else perform vault.update_secret(sid,p_data->>'apiSecret');end if;
  end if;
  if nullif(p_data->>'clientSecret','') is not null then
   if cid is null then select vault.create_secret(p_data->>'clientSecret','bni-snap-client-'||gen_random_uuid()::text) into cid;else perform vault.update_secret(cid,p_data->>'clientSecret');end if;
  end if;
  insert into snap_sandbox_internal.bni_snap_config(id,client_id,api_key,api_secret_id,client_secret_id,merchant_id,terminal_id,channel_id,certificate)
  values(true,p_data->>'clientId',coalesce(nullif(p_data->>'apiKey',''),c.api_key),sid,cid,coalesce(p_data->>'merchantId',''),coalesce(p_data->>'terminalId',''),coalesce(p_data->>'channelId',''),coalesce(p_data->>'certificate',c.certificate,''))
  on conflict(id) do update set client_id=excluded.client_id,api_key=excluded.api_key,api_secret_id=excluded.api_secret_id,client_secret_id=excluded.client_secret_id,merchant_id=excluded.merchant_id,terminal_id=excluded.terminal_id,channel_id=excluded.channel_id,certificate=excluded.certificate,updated_at=now();
  insert into public.log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_baru) values(nullif(p_data->>'oleh','')::uuid,'atur_bni_snap_sandbox','snap_sandbox','bni_snap',jsonb_build_object('kredensial_diubah',nullif(p_data->>'apiSecret','') is not null));
  return jsonb_build_object('ok',true);
 elsif p_action='config' then
  if c.id is null or g.id is null then raise exception 'Konfigurasi BNI belum lengkap';end if;
  select decrypted_secret into secret from vault.decrypted_secrets where id=c.api_secret_id;
  select decrypted_secret into cs from vault.decrypted_secrets where id=c.client_secret_id;
  select decrypted_secret into prv from vault.decrypted_secrets where id=g.private_secret_id;
  return jsonb_build_object('clientId',c.client_id,'apiKey',c.api_key,'apiSecret',secret,'clientSecret',cs,'privateKey',prv,'publicKey',g.public_key,'certificate',c.certificate,'merchantId',c.merchant_id,'channelId',c.channel_id,'terminalId',c.terminal_id,'version',md5(c.updated_at::text||g.public_key));
 elsif p_action='record' then
  r:=p_data->'result';
  if r->>'action' not in ('token','generate','query') or length(r::text)>16000 then raise exception 'Riwayat invalid';end if;
  if (r->'response') ?| array['accessToken','access_token','clientSecret','privateKey','customerName','customerPan'] then raise exception 'Respons tidak boleh memuat rahasia';end if;
  insert into snap_sandbox_internal.bni_snap_history(oleh,action,result) values(nullif(p_data->>'oleh','')::uuid,r->>'action',r) returning id into h;
  delete from snap_sandbox_internal.bni_snap_history where id in (select id from snap_sandbox_internal.bni_snap_history order by created_at desc offset 200);
  return jsonb_build_object('id',h);
 elsif p_action='generation' then
  select result into r from snap_sandbox_internal.bni_snap_history where id=(p_data->>'id')::uuid and action='generate';
  return coalesce(r,'{}'::jsonb);
 end if;
 raise exception 'Aksi tidak tersedia';
end $$;
revoke all on function public.bni_snap_service(text,jsonb) from public,anon,authenticated;
grant execute on function public.bni_snap_service(text,jsonb) to service_role;
create policy deny_bni_snap_config on snap_sandbox_internal.bni_snap_config for all to authenticated using(false) with check(false);
create policy deny_bni_snap_history on snap_sandbox_internal.bni_snap_history for all to authenticated using(false) with check(false);
