-- Inbound sandbox inbox only. Does not update POS, payments or stock.
create table bni_internal.snap_client (
 client_id text primary key check(client_id ~ '^[A-Za-z0-9_-]{3,100}$'),
 partner_id text not null unique check(partner_id=client_id),
 api_secret_id uuid not null references vault.secrets(id),
 bank_public_key text not null default '',active boolean not null default false,
 environment text not null default 'sandbox' check(environment='sandbox'),
 created_at timestamptz not null default now(),
 check(not active or bank_public_key like '-----BEGIN PUBLIC KEY-----%')
);
create table bni_internal.snap_inbox (
 client_id text not null references bni_internal.snap_client(client_id),
 external_id text not null check(external_id ~ '^[A-Za-z0-9_-]{1,36}$'),
 body_hash text not null check(body_hash ~ '^[a-f0-9]{64}$'),
 payload jsonb not null check(octet_length(payload::text)<=16384),
 environment text not null default 'sandbox' check(environment='sandbox'),
 processing_status text not null default 'RECEIVED_NOT_RECONCILED' check(processing_status='RECEIVED_NOT_RECONCILED'),
 received_at timestamptz not null default now(),primary key(client_id,external_id)
);
alter table bni_internal.snap_client enable row level security;
alter table bni_internal.snap_inbox enable row level security;
revoke all on bni_internal.snap_client,bni_internal.snap_inbox from public,anon,authenticated;
create function public.bni_inbound_config(p_id text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role'
 and coalesce(current_setting('request.jwt.claims',true),'{}')::jsonb->>'role' is distinct from 'service_role' then raise exception 'Forbidden';end if;
 select jsonb_build_object('clientId',c.client_id,'partnerId',c.partner_id,'apiSecret',a.decrypted_secret,
 'bankPublicKey',c.bank_public_key,'active',c.active and k.aktif,'privateKey',p.decrypted_secret,'publicKey',k.public_key)
 into result from bni_internal.snap_client c cross join bni_internal.konfigurasi k
 join vault.decrypted_secrets p on p.id=k.private_secret_id
 join vault.decrypted_secrets a on a.id=c.api_secret_id
 where c.client_id=p_id and k.id;
 return result;
end $$;
create function public.bni_inbound_receive(p_client text,p_external text,p_hash text,p_payload jsonb) returns text
language plpgsql security definer set search_path='' as $$
declare old_hash text;
begin
 if coalesce(current_setting('request.jwt.claim.role',true),'')<>'service_role'
 and coalesce(current_setting('request.jwt.claims',true),'{}')::jsonb->>'role' is distinct from 'service_role' then raise exception 'Forbidden';end if;
 if not exists(select 1 from bni_internal.snap_client c cross join bni_internal.konfigurasi k
 where c.client_id=p_client and c.active and k.aktif and k.id) then raise exception 'Client unavailable';end if;
 if p_hash !~ '^[a-f0-9]{64}$' or p_external !~ '^[A-Za-z0-9_-]{1,36}$' or octet_length(p_payload::text)>16384
 or jsonb_typeof(p_payload)<>'object' then raise exception 'Invalid request';end if;
 insert into bni_internal.snap_inbox(client_id,external_id,body_hash,payload) values(p_client,p_external,p_hash,p_payload)
 on conflict(client_id,external_id) do nothing;
 if found then return 'received';end if;
 select body_hash into old_hash from bni_internal.snap_inbox where client_id=p_client and external_id=p_external;
 if old_hash=p_hash then return 'duplicate';end if;
 return 'conflict';
end $$;
revoke all on function public.bni_inbound_config(text),public.bni_inbound_receive(text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.bni_inbound_config(text),public.bni_inbound_receive(text,text,text,jsonb) to service_role;
notify pgrst,'reload schema';
