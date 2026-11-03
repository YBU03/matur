-- Gateway penerima BNI: tidak menulis transaksi, pembayaran, stok, maupun buku besar.
create schema if not exists bni_internal;
revoke all on schema bni_internal from public,anon,authenticated;
create table bni_internal.konfigurasi (
 id boolean primary key default true check(id), client_id text not null unique,
 private_secret_id uuid not null references vault.secrets(id),
 client_secret_id uuid not null references vault.secrets(id),
 public_key text not null, aktif boolean not null default false
);
create table bni_internal.outlet (
 kode text primary key check(kode in ('KOMINOT','UHB')), outlet_id uuid not null unique references public.outlet(id)
);
insert into bni_internal.outlet(kode,outlet_id) select 'KOMINOT',id from public.outlet where nama='Ruma Kopi Kominot' and mode='asli' and deleted_at is null;
insert into bni_internal.outlet(kode,outlet_id) select 'UHB',id from public.outlet where nama='Ruma Kopi UHB' and mode='asli' and deleted_at is null;
create table bni_internal.batas (
 kunci text primary key, mulai timestamptz not null, jumlah integer not null
);
create table bni_internal.notifikasi (
 client_id text not null, event_id text not null, outlet_id uuid not null references public.outlet,
 reference_no text not null, body_hash text not null, payload jsonb not null,
 is_test boolean not null default false, diterima_at timestamptz not null default now(),
 status text not null default 'diterima_belum_direkonsiliasi', primary key(client_id,event_id)
);
create index on bni_internal.notifikasi(outlet_id,diterima_at desc);
alter table bni_internal.konfigurasi enable row level security;
alter table bni_internal.outlet enable row level security;
alter table bni_internal.batas enable row level security;
alter table bni_internal.notifikasi enable row level security;
-- Seluruh akses hanya melalui fungsi khusus service-role; aplikasi pengguna tidak diberi akses tabel.
create function public.bni_gateway_konfigurasi() returns jsonb
language plpgsql security definer set search_path=public as $$
declare hasil jsonb;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Tidak diizinkan';end if;
 select jsonb_build_object('clientId',k.client_id,'clientSecret',c.decrypted_secret,'privateKey',s.decrypted_secret,'publicKey',k.public_key,'active',k.aktif)
 into hasil from bni_internal.konfigurasi k join vault.decrypted_secrets c on c.id=k.client_secret_id join vault.decrypted_secrets s on s.id=k.private_secret_id where k.id;
 return hasil;
end $$;
create function public.bni_gateway_batas(p_kunci text,p_limit integer) returns boolean
language plpgsql security definer set search_path=public as $$
declare n integer; t timestamptz:=date_trunc('minute',clock_timestamp());
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Tidak diizinkan';end if;
 if length(p_kunci)>100 or p_limit<1 or p_limit>1000 then return false;end if;
 insert into bni_internal.batas values(p_kunci,t,1) on conflict(kunci) do update set
 mulai=excluded.mulai,jumlah=case when batas.mulai=excluded.mulai then batas.jumlah+1 else 1 end returning jumlah into n;
 return n<=p_limit;
end $$;
create function public.bni_gateway_terima(p_client text,p_event text,p_kode text,p_ref text,p_hash text,p_payload jsonb,p_test boolean) returns text
language plpgsql security definer set search_path=public as $$
declare o uuid; lama text;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Tidak diizinkan';end if;
 if not exists(select 1 from bni_internal.konfigurasi where client_id=p_client and aktif) then raise exception 'Client tidak aktif';end if;
 if length(p_event) not between 1 and 120 or length(p_ref) not between 1 and 120 or p_hash !~ '^[a-f0-9]{64}$' or octet_length(p_payload::text)>16384 then raise exception 'Payload tidak valid';end if;
 select outlet_id into o from bni_internal.outlet where kode=p_kode;
 if o is null then raise exception 'Outlet tidak terdaftar';end if;
 insert into bni_internal.notifikasi(client_id,event_id,outlet_id,reference_no,body_hash,payload,is_test)
 values(p_client,p_event,o,p_ref,p_hash,p_payload,p_test) on conflict(client_id,event_id) do nothing;
 if found then return 'received';end if;
 select body_hash into lama from bni_internal.notifikasi where client_id=p_client and event_id=p_event;
 if lama<>p_hash then return 'conflict';end if;
 return 'duplicate';
end $$;
revoke all on function public.bni_gateway_konfigurasi() from public,anon,authenticated;
revoke all on function public.bni_gateway_batas(text,integer) from public,anon,authenticated;
revoke all on function public.bni_gateway_terima(text,text,text,text,text,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.bni_gateway_konfigurasi(),public.bni_gateway_batas(text,integer),public.bni_gateway_terima(text,text,text,text,text,jsonb,boolean) to service_role;
notify pgrst, 'reload schema';
