-- Lingkungan uji terpisah: tidak menulis transaksi, pembayaran, stok atau akuntansi.
create schema snap_sandbox_internal;
revoke all on schema snap_sandbox_internal from public,anon,authenticated;
grant usage on schema snap_sandbox_internal to authenticated,service_role;
create table snap_sandbox_internal.config (
 id boolean primary key default true check(id), client_id text not null,
 secrets_id uuid not null references vault.secrets(id), public_pem text not null,
 aktif boolean not null default false, diubah_at timestamptz not null default now()
);
create table snap_sandbox_internal.hasil (
 id uuid primary key default gen_random_uuid(), nomor int not null check(nomor between 1 and 10),
 status text not null check(status in ('dicoba','sesuai','tidak_sesuai')), catatan text not null default '',
 respons jsonb not null default '{}', bukti_path text, dibuat_oleh uuid not null references public.pengguna,
 created_at timestamptz not null default now()
);
create table snap_sandbox_internal.intent (
 ref text primary key, amount text not null check(amount ~ '^[0-9]{1,12}\.[0-9]{2}$'),
 created_at timestamptz not null default now(), status text not null default 'pending'
);
create table snap_sandbox_internal.inbox (
 external_id text primary key, ref text not null references snap_sandbox_internal.intent(ref),
 hash text not null, status text not null, amount text not null,
 created_at timestamptz not null default now()
);
create table snap_sandbox_internal.batas(kunci text primary key, menit timestamptz not null,jumlah int not null);
alter table snap_sandbox_internal.config enable row level security;
alter table snap_sandbox_internal.hasil enable row level security;
alter table snap_sandbox_internal.intent enable row level security;
alter table snap_sandbox_internal.inbox enable row level security;
alter table snap_sandbox_internal.batas enable row level security;
revoke all on all tables in schema snap_sandbox_internal from public,anon,authenticated;
create policy deny_config on snap_sandbox_internal.config for all to authenticated using(false) with check(false);
create policy deny_hasil on snap_sandbox_internal.hasil for all to authenticated using(false) with check(false);
create policy deny_intent on snap_sandbox_internal.intent for all to authenticated using(false) with check(false);
create policy deny_inbox on snap_sandbox_internal.inbox for all to authenticated using(false) with check(false);
create policy deny_batas on snap_sandbox_internal.batas for all to authenticated using(false) with check(false);

create function snap_sandbox_internal.boleh_admin() returns boolean
language sql stable security invoker set search_path='' as $$
 select auth.uid() is not null and exists (
  select 1 from public.pengguna u join public.penugasan p on p.pengguna_id=u.id
  where u.id=auth.uid() and u.status='aktif' and p.peran in ('owner','admin_pusat','finance')
 );
$$;
revoke all on function snap_sandbox_internal.boleh_admin() from public,anon;
grant execute on function snap_sandbox_internal.boleh_admin() to authenticated,service_role;

create function snap_sandbox_internal.admin(p_action text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c snap_sandbox_internal.config; s jsonb; k uuid; x text; n int; safe_note text; clean_response jsonb; field text;
begin
 if not snap_sandbox_internal.boleh_admin() then raise exception 'Hanya Owner, Admin Pusat atau Finance aktif';end if;
 if octet_length(p_data::text)>32768 then raise exception 'Data terlalu besar';end if;
 if p_action='save' then
  perform pg_advisory_xact_lock(hashtext('matoer-snap-sandbox-config'));
  select * into c from snap_sandbox_internal.config where id for update;
  x:=trim(p_data->>'clientId');
  if x is null or x !~ '^[A-Za-z0-9._-]{3,100}$' then raise exception 'Client ID tidak valid';end if;
  if c.id is null then
   if coalesce(length(p_data->>'clientSecret'),0)<10 or coalesce(length(p_data->>'privateRef'),0)<10 or coalesce(length(p_data->>'receiverPrivate'),0)<500 or coalesce(length(p_data->>'jwtSecret'),0)<32 then raise exception 'Lengkapi kredensial sandbox';end if;
   s:=jsonb_build_object('clientSecret',p_data->>'clientSecret','privateRef',p_data->>'privateRef','publicRef',p_data->>'publicRef','receiverPrivate',p_data->>'receiverPrivate','jwtSecret',p_data->>'jwtSecret');
   select vault.create_secret(s::text,'matoer-snap-sandbox-'||gen_random_uuid()::text) into k;
   insert into snap_sandbox_internal.config(id,client_id,secrets_id,public_pem,aktif) values(true,x,k,p_data->>'receiverPublic',false);
  else
   if c.client_id<>x and (coalesce(p_data->>'clientSecret','')='' or coalesce(p_data->>'privateRef','')='') then raise exception 'Client ID berubah, isi ulang secret dan private key ASPI';end if;
   select decrypted_secret::jsonb into s from vault.decrypted_secrets where id=c.secrets_id;
   foreach x in array array['clientSecret','privateRef','publicRef'] loop
    if coalesce(p_data->>x,'')<>'' then s:=jsonb_set(s,array[x],to_jsonb(p_data->>x));end if;
   end loop;
   perform vault.update_secret(c.secrets_id,s::text);
   update snap_sandbox_internal.config set client_id=trim(p_data->>'clientId'),aktif=false,diubah_at=now() where id;
  end if;
  insert into public.log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_baru) values(auth.uid(),'snap_sandbox_simpan','integrasi','sandbox',jsonb_build_object('configured',true));
 elsif p_action='toggle' then
  update snap_sandbox_internal.config set aktif=(p_data->>'aktif')::boolean,diubah_at=now() where id;
  if not found then raise exception 'Simpan konfigurasi terlebih dahulu';end if;
  insert into public.log_aktivitas(pengguna_id,aksi,entitas,entitas_id,nilai_baru) values(auth.uid(),'snap_sandbox_aktif','integrasi','sandbox',jsonb_build_object('aktif',(p_data->>'aktif')::boolean));
 elsif p_action='result' then
  n:=(p_data->>'nomor')::int;
  if n not between 1 and 10 or p_data->>'status' not in ('dicoba','sesuai','tidak_sesuai') then raise exception 'Hasil pengujian tidak valid';end if;
  x:=nullif(p_data->>'buktiPath','');
  if x is not null and (left(x,length(auth.uid()::text)+1)<>auth.uid()::text||'/' or not exists(select 1 from storage.objects where bucket_id='snap-sandbox-bukti' and name=x)) then raise exception 'Bukti tidak ditemukan atau bukan milik akun ini';end if;
  if p_data->>'status'='sesuai' and x is null and not (coalesce(p_data->'respons','{}') ? 'responseCode') then raise exception 'Lampirkan bukti atau kode respons';end if;
  select coalesce(jsonb_object_agg(e.key,left(e.value#>>'{}',200)),'{}') into clean_response from jsonb_each(coalesce(p_data->'respons','{}')) e
   where e.key in ('responseCode','responseMessage','referenceNo','partnerReferenceNo','originalReferenceNo','originalPartnerReferenceNo','latestTransactionStatus','transactionStatusDesc') and jsonb_typeof(e.value)='string';
  safe_note:=regexp_replace(left(coalesce(p_data->>'catatan',''),2000),'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+','[token ditutup]','g');
  select v.decrypted_secret::jsonb into s from vault.decrypted_secrets v join snap_sandbox_internal.config cfg on cfg.secrets_id=v.id where cfg.id;
  if s is not null then
   for s in select value from jsonb_each(s) where key in ('clientSecret','privateRef','receiverPrivate','jwtSecret') loop
    if length(s#>>'{}')>0 then
     safe_note:=replace(safe_note,s#>>'{}','[rahasia ditutup]');
     for field in select jsonb_object_keys(clean_response) loop
      clean_response:=jsonb_set(clean_response,array[field],to_jsonb(replace(clean_response->>field,s#>>'{}','[rahasia ditutup]')));
     end loop;
    end if;
   end loop;
  end if;
  clean_response:=regexp_replace(clean_response::text,'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+','[token ditutup]','g')::jsonb;
  insert into snap_sandbox_internal.hasil(nomor,status,catatan,respons,bukti_path,dibuat_oleh)
  values(n,p_data->>'status',safe_note,clean_response,x,auth.uid());
 elsif p_action<>'status' then raise exception 'Aksi tidak dikenal';
 end if;
 select * into c from snap_sandbox_internal.config where id;
 return jsonb_build_object('configured',c.id is not null,'clientId',c.client_id,'aktif',coalesce(c.aktif,false),'publicKey',c.public_pem,
 'hasil',coalesce((select jsonb_agg(r order by r.created_at desc) from (select id,nomor,status,catatan,respons,bukti_path,created_at from snap_sandbox_internal.hasil order by created_at desc limit 100)r),'[]'),
 'inbox',coalesce((select jsonb_agg(r order by r.created_at desc) from (select external_id,ref,status,amount,created_at from snap_sandbox_internal.inbox order by created_at desc limit 30)r),'[]'));
end $$;
revoke all on function snap_sandbox_internal.admin(text,jsonb) from public,anon;
grant execute on function snap_sandbox_internal.admin(text,jsonb) to authenticated;
create function public.snap_sandbox_admin(p_action text default 'status',p_data jsonb default '{}') returns jsonb
language sql security invoker set search_path='' as $$select snap_sandbox_internal.admin(p_action,p_data)$$;
revoke all on function public.snap_sandbox_admin(text,jsonb) from public,anon;
grant execute on function public.snap_sandbox_admin(text,jsonb) to authenticated;

create function snap_sandbox_internal.service(p_action text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c snap_sandbox_internal.config;s jsonb;n int;lama snap_sandbox_internal.inbox;i snap_sandbox_internal.intent;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Server only';end if;
 if p_action='config' then
  select * into c from snap_sandbox_internal.config where id;
  if c.id is null then return null;end if;
  select decrypted_secret::jsonb into s from vault.decrypted_secrets where id=c.secrets_id;
  return s||jsonb_build_object('clientId',c.client_id,'aktif',c.aktif,'receiverPublic',c.public_pem);
 elsif p_action='limit' then
  insert into snap_sandbox_internal.batas values(left(p_data->>'key',100),date_trunc('minute',now()),1) on conflict(kunci) do update set menit=excluded.menit,jumlah=case when batas.menit=excluded.menit then batas.jumlah+1 else 1 end returning jumlah into n;
  return to_jsonb(n<=120);
 elsif p_action='intent' then
  insert into snap_sandbox_internal.intent(ref,amount) values(p_data->>'ref',p_data->>'amount');return '{}'::jsonb;
 elsif p_action='receive' then
  perform pg_advisory_xact_lock(hashtext('snap-sandbox-external:'||(p_data->>'external')));
  perform pg_advisory_xact_lock(hashtext('snap-sandbox:'||(p_data->>'ref')));
  select * into i from snap_sandbox_internal.intent where ref=p_data->>'ref' for update;
  if i.ref is null then return '"not_found"';end if;
  if i.amount<>p_data->>'amount' then return '"amount_mismatch"';end if;
  select * into lama from snap_sandbox_internal.inbox where external_id=p_data->>'external';
  if lama.external_id is not null then return to_jsonb(case when lama.hash=p_data->>'hash' then 'duplicate' else 'conflict' end);end if;
  if i.status='00' and p_data->>'status'<>'00' then return '"conflict"';end if;
  insert into snap_sandbox_internal.inbox(external_id,ref,hash,status,amount) values(p_data->>'external',i.ref,p_data->>'hash',p_data->>'status',i.amount);
  update snap_sandbox_internal.intent set status=p_data->>'status' where ref=i.ref;
  return '"received"';
 end if;
 raise exception 'Unknown action';
end $$;
revoke all on function snap_sandbox_internal.service(text,jsonb) from public,anon,authenticated;
grant execute on function snap_sandbox_internal.service(text,jsonb) to service_role;
create function public.snap_sandbox_service(p_action text,p_data jsonb default '{}') returns jsonb
language sql security invoker set search_path='' as $$select snap_sandbox_internal.service(p_action,p_data)$$;
revoke all on function public.snap_sandbox_service(text,jsonb) from public,anon,authenticated;
grant execute on function public.snap_sandbox_service(text,jsonb) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('snap-sandbox-bukti','snap-sandbox-bukti',false,5242880,array['image/png','image/jpeg','application/pdf']);
create policy snap_bukti_insert on storage.objects for insert to authenticated with check(bucket_id='snap-sandbox-bukti' and (storage.foldername(name))[1]=auth.uid()::text and snap_sandbox_internal.boleh_admin());
create policy snap_bukti_select on storage.objects for select to authenticated using(bucket_id='snap-sandbox-bukti' and snap_sandbox_internal.boleh_admin());
notify pgrst,'reload schema';
